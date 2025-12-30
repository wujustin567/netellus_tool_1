import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { fetchDatabase } from './services/dataService.ts';
import { DatabaseRow, UserGoal, GoalPath } from './types.ts';

const App: React.FC = () => {
  const [db, setDb] = useState<DatabaseRow[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  // Profile State
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [industrySearch, setIndustrySearch] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [taxId, setTaxId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Goal Setting State
  const [showGoalSetting, setShowGoalSetting] = useState(false);
  const [userGoal, setUserGoal] = useState<UserGoal | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [goalPath, setGoalPath] = useState<GoalPath>('carbon');
  const [currentVal, setCurrentVal] = useState<string>('');
  const [targetVal, setTargetVal] = useState<string>('');
  const [targetType, setTargetType] = useState<'percentage' | 'absolute'>('percentage');

  // Dashboard State
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [selectedMeasure, setSelectedMeasure] = useState<DatabaseRow | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchDatabase().then(data => {
      setDb(data);
      setIsDbLoading(false);
    }).catch(err => {
      console.error("Failed to load database", err);
      setIsDbLoading(false);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetApp = () => {
    setIsProfileComplete(false);
    setShowGoalSetting(false);
    setSelectedIndustry('');
    setIndustrySearch('');
    setTaxId('');
    setPhone('');
    setUserGoal(null);
    setSelectedSystem(null);
    setSelectedMeasure(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const industries = useMemo(() => Array.from(new Set(db.map(r => r.案例公司產業別))).filter(Boolean).sort(), [db]);

  const filteredSuggestions = useMemo(() => {
    if (!industrySearch) return [];
    const searchLower = industrySearch.toLowerCase();
    return industries.filter(ind => ind.toLowerCase().includes(searchLower)).slice(0, 8);
  }, [industrySearch, industries]);

  const systemDistribution = useMemo(() => {
    if (!selectedIndustry || db.length === 0) return [];
    const industryRows = db.filter(r => r.案例公司產業別 === selectedIndustry);
    const systemsMap = new Map<string, number>();
    industryRows.forEach(r => {
      const pct = parseFloat(r["a_系統佔比(同產業)"]?.replace('%', '')) || 0;
      systemsMap.set(r.系統名稱, pct);
    });
    return Array.from(systemsMap.entries()).map(([name, percentage]) => ({ name, percentage }));
  }, [selectedIndustry, db]);

  const measureDistribution = useMemo(() => {
    if (!selectedIndustry || !selectedSystem || db.length === 0) return [];
    return db.filter(r => r.案例公司產業別 === selectedIndustry && r.系統名稱 === selectedSystem);
  }, [selectedIndustry, selectedSystem, db]);

  const recommendations = useMemo(() => {
    if (!selectedIndustry || !userGoal || db.length === 0) return null;
    let targetX = userGoal.targetType === 'percentage' 
      ? (parseFloat(currentVal) || 0) * (userGoal.targetValue / 100)
      : userGoal.targetValue;

    const industryActions = db.filter(r => r.案例公司產業別 === selectedIndustry);
    if (industryActions.length === 0) return null;
    const parseNum = (s: string) => parseFloat(s?.replace(/,/g, '')) || 0;

    const bestMatch = industryActions.reduce((prev, curr) => {
      const isCarbon = userGoal.path === 'carbon';
      const prevVal = isCarbon ? parseNum(prev.c_碳減量中位數) : parseNum(prev.c_節能潛力中位數) * 1000;
      const currVal = isCarbon ? parseNum(curr.c_碳減量中位數) : parseNum(curr.c_節能潛力中位數) * 1000;
      return Math.abs(currVal - targetX) < Math.abs(prevVal - targetX) ? curr : prev;
    });

    return { bestMatch, targetX };
  }, [selectedIndustry, userGoal, db, currentVal]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (industries.includes(selectedIndustry) && taxId.length === 8) {
      setIsProfileComplete(true);
      setShowGoalSetting(true);
    }
  };

  const handleConfirmGoal = () => {
    setIsScanning(true);
    setTimeout(() => {
      setUserGoal({
        path: goalPath,
        currentValue: parseFloat(currentVal) || 0,
        targetType: targetType,
        targetValue: parseFloat(targetVal) || 0
      });
      setIsScanning(false);
      setShowGoalSetting(false);
      if (systemDistribution.length > 0) setSelectedSystem(systemDistribution[0].name);
    }, 800);
  };

  const formatDbValue = (val: string, multiplyBy: number = 1) => {
    if (!val) return "0";
    const num = parseFloat(val.replace(/,/g, '')) * multiplyBy;
    return isNaN(num) ? val : num.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  if (isDbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white/50 backdrop-blur-md">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2D9B3A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold tracking-widest text-xs uppercase">Initializing System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-4 bg-white/90 backdrop-blur-xl shadow-sm' : 'py-8 bg-transparent'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="cursor-pointer group" onClick={resetApp}>
            <span className="text-2xl font-black tracking-tighter text-slate-900 group-hover:text-[#2D9B3A] transition-colors">Netellus</span>
            <p className="text-[9px] font-black tracking-[0.2em] text-[#2D9B3A] uppercase">Action Intelligence</p>
          </div>
          {isProfileComplete && (
            <button onClick={() => setIsProfileComplete(false)} className="px-5 py-2 rounded-full border border-slate-200 text-[10px] font-black uppercase bg-white/50 hover:bg-white transition-all">修改產業</button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 pt-32 pb-20 max-w-6xl">
        {!isProfileComplete ? (
          <div className="max-w-xl mx-auto bg-white/80 backdrop-blur-3xl p-10 sm:p-14 rounded-[3rem] border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-500">
             <h2 className="text-3xl font-black mb-8 text-center tracking-tight">企業減碳路徑診斷</h2>
             <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="relative" ref={suggestionRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">產業搜尋</label>
                  <input type="text" value={industrySearch} onChange={(e) => { setIndustrySearch(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-[#43FF59] transition-all" placeholder="如：電子零組件、紡織..." />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl max-h-60 overflow-y-auto">
                      {filteredSuggestions.map((ind, i) => (
                        <div key={i} onClick={() => { setSelectedIndustry(ind); setIndustrySearch(ind); setShowSuggestions(false); }} className="px-6 py-4 cursor-pointer hover:bg-[#43FF59]/10 font-bold text-sm text-slate-600 border-b border-slate-50">{ind}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">公司統編</label>
                  <input required type="text" maxLength={8} value={taxId} onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))} className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold outline-none focus:border-[#43FF59] transition-all" placeholder="8 位數字" />
                </div>
                <button type="submit" disabled={!industries.includes(selectedIndustry)} className="w-full bg-[#43FF59] text-slate-900 py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-[#43FF59]/30 transition-all disabled:opacity-20">開始分析</button>
             </form>
          </div>
        ) : showGoalSetting ? (
          <div className="max-w-3xl mx-auto bg-white/80 backdrop-blur-3xl p-12 rounded-[4rem] border border-slate-200 text-center shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-10">
            {isScanning && <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center font-black animate-pulse text-[#2D9B3A]">匹配實績資料庫中...</div>}
            <h2 className="text-4xl font-black mb-12 tracking-tight">設定年度目標</h2>
            <div className="flex justify-center space-x-4 mb-10">
              <button onClick={() => setGoalPath('carbon')} className={`px-10 py-4 rounded-2xl font-black transition-all ${goalPath === 'carbon' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>減碳目標</button>
              <button onClick={() => setGoalPath('energy')} className={`px-10 py-4 rounded-2xl font-black transition-all ${goalPath === 'energy' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>節能目標</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
              <input type="number" value={currentVal} onChange={(e) => setCurrentVal(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-8 text-3xl font-black text-center outline-none focus:border-[#43FF59]" placeholder="目前量" />
              <input type="number" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-8 text-3xl font-black text-center outline-none focus:border-[#43FF59]" placeholder="目標值" />
            </div>
            <button onClick={handleConfirmGoal} className="w-full bg-[#43FF59] py-8 rounded-3xl font-black text-xl hover:bg-[#32e048] shadow-xl">獲取最佳方案</button>
          </div>
        ) : (
          <div className="space-y-16 animate-in fade-in duration-700">
            {recommendations && (
              <section className="bg-slate-900 p-10 sm:p-20 rounded-[4rem] border border-white/10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#43FF59]/10 rounded-full blur-[100px]"></div>
                <div className="relative z-10">
                  <span className="text-[10px] font-black text-[#43FF59] tracking-[0.5em] uppercase mb-6 block">Recommended System</span>
                  <h2 className="text-4xl sm:text-6xl font-black mb-10 leading-tight tracking-tighter">{recommendations.bestMatch.系統名稱}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                      <p className="text-[10px] font-black text-white/30 uppercase mb-2">年減碳中位數</p>
                      <p className="text-2xl font-black">{formatDbValue(recommendations.bestMatch.c_碳減量中位數)} <span className="text-xs text-white/40">噸</span></p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                      <p className="text-[10px] font-black text-white/30 uppercase mb-2">平均回收年限</p>
                      <p className="text-2xl font-black">{formatDbValue(recommendations.bestMatch.c_回收年限中位數)} <span className="text-xs text-white/40">年</span></p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                      <p className="text-[10px] font-black text-white/30 uppercase mb-2">投資成本</p>
                      <p className="text-2xl font-black">{formatDbValue(recommendations.bestMatch.c_投資成本中位數)} <span className="text-xs text-white/40">萬</span></p>
                    </div>
                    <button onClick={() => window.open('https://rfq.netellus.com/rfq/create', '_blank')} className="bg-[#43FF59] text-slate-900 rounded-3xl font-black hover:scale-105 transition-all text-sm px-4">取得報價</button>
                  </div>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5 bg-white/80 p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black mb-10 flex items-center"><span className="w-1.5 h-6 bg-[#43FF59] rounded-full mr-3"></span>能耗佔比分析</h3>
                <div className="h-72 w-full relative mb-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={systemDistribution} dataKey="percentage" cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" paddingAngle={5} onClick={(_, idx) => setSelectedSystem(systemDistribution[idx].name)}>
                        {systemDistribution.map((e: any, i: number) => <Cell key={i} fill={selectedSystem === e.name ? '#2D9B3A' : '#F1F5F9'} className="cursor-pointer" />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-black text-slate-900">{systemDistribution.find(s => s.name === selectedSystem)?.percentage || 0}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">系統佔比</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {systemDistribution.map(sys => (
                    <button key={sys.name} onClick={() => { setSelectedSystem(sys.name); setSelectedMeasure(null); }} className={`w-full p-5 rounded-2xl text-left flex justify-between items-center font-bold border-2 transition-all ${selectedSystem === sys.name ? 'border-[#2D9B3A] bg-[#2D9B3A]/5' : 'border-slate-50'}`}>
                      <span className="text-sm">{sys.name}</span>
                      <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full">{sys.percentage}%</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 space-y-10">
                <div className="bg-white/80 p-10 rounded-[3rem] border border-slate-200 shadow-sm min-h-[400px]">
                  <h3 className="text-xl font-black mb-8">細項措施：{selectedSystem || '請選擇類別'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {measureDistribution.map((m: any, i: number) => (
                      <button key={i} onClick={() => setSelectedMeasure(m)} className={`p-8 rounded-[2.5rem] text-left border-2 transition-all ${selectedMeasure?.措施類型 === m.措施類型 ? 'border-[#2D9B3A] bg-[#2D9B3A]/5 scale-[1.02]' : 'border-slate-50 bg-slate-50 hover:bg-white'}`}>
                        <p className="font-black text-lg mb-4 text-slate-800 leading-snug">{m.措施類型}</p>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-[#2D9B3A]">
                           <span>普及率 {m["b_措施佔比(同產業×系統)"]}</span>
                        </div>
                      </button>
                    ))}
                    {measureDistribution.length === 0 && <p className="col-span-full text-center py-20 text-slate-300 font-bold uppercase tracking-widest italic">點擊左側圓餅圖查看細項</p>}
                  </div>
                </div>

                {selectedMeasure && (
                  <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white animate-in slide-in-from-bottom-8 duration-500 shadow-2xl">
                    <h3 className="text-xl font-black mb-10 text-center tracking-widest opacity-60">ROI 成效試算</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">年節能量</p>
                        <p className="text-xl font-black text-[#43FF59]">{formatDbValue(selectedMeasure.c_節能潛力中位數, 1000)} <span className="text-[9px] text-white/40">度</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">初期投資</p>
                        <p className="text-xl font-black text-[#43FF59]">{formatDbValue(selectedMeasure.c_投資成本中位數)} <span className="text-[9px] text-white/40">萬</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">回收年限</p>
                        <p className="text-xl font-black text-[#43FF59]">{formatDbValue(selectedMeasure.c_回收年限中位數)} <span className="text-[9px] text-white/40">年</span></p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;