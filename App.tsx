
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { fetchDatabase } from './services/dataService';
import { DatabaseRow, UserGoal, GoalPath } from './types';

const App: React.FC = () => {
  const [db, setDb] = useState<DatabaseRow[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  // Profile State
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [industrySearch, setIndustrySearch] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [taxId, setTaxId] = useState<string>('');
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
    console.log("Fetching database...");
    fetchDatabase().then(data => {
      console.log("Database loaded, rows:", data.length);
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
    if (industries.includes(selectedIndustry)) {
      setIsProfileComplete(true);
      setShowGoalSetting(true);
    }
  };

  const handleConfirmGoal = () => {
    setIsScanning(true);
    setTimeout(() => {
      // Corrected targetValue usage from targetVal state variable
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Loading Netellus Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'py-4 bg-white/80 backdrop-blur-md shadow-sm' : 'py-6 bg-transparent'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="cursor-pointer" onClick={resetApp}>
            <span className="text-xl font-black tracking-tighter text-slate-900">Netellus</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 pt-32 pb-20">
        {!isProfileComplete ? (
          <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
             <h2 className="text-2xl font-black mb-6 text-center">產業路徑診斷</h2>
             <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="relative" ref={suggestionRef}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">產業搜尋</label>
                  <input 
                    type="text" 
                    value={industrySearch} 
                    onChange={(e) => { setIndustrySearch(e.target.value); setShowSuggestions(true); }} 
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-emerald-500 transition-all" 
                    placeholder="輸入關鍵字..." 
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                      {filteredSuggestions.map((ind, i) => (
                        <div key={i} onClick={() => { setSelectedIndustry(ind); setIndustrySearch(ind); setShowSuggestions(false); }} className="px-4 py-3 cursor-pointer hover:bg-emerald-50 font-bold text-sm text-slate-600 border-b border-slate-50 last:border-0">{ind}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">公司統編</label>
                  <input required type="text" maxLength={8} value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-emerald-500 transition-all" placeholder="8位數字" />
                </div>
                <button type="submit" disabled={!industries.includes(selectedIndustry)} className="w-full bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-30">分析產業數據</button>
             </form>
          </div>
        ) : showGoalSetting ? (
          <div className="max-w-xl mx-auto bg-white p-10 rounded-3xl border border-slate-200 text-center shadow-xl">
            <h2 className="text-2xl font-black mb-8">設定年度減碳目標</h2>
            <div className="flex space-x-2 mb-8">
              <button onClick={() => setGoalPath('carbon')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${goalPath === 'carbon' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>減碳</button>
              <button onClick={() => setGoalPath('energy')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${goalPath === 'energy' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>節能</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <input type="number" value={currentVal} onChange={(e) => setCurrentVal(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xl font-bold text-center outline-none focus:border-emerald-500" placeholder="目前值" />
              <input type="number" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xl font-bold text-center outline-none focus:border-emerald-500" placeholder="目標值" />
            </div>
            <button onClick={handleConfirmGoal} className="w-full bg-emerald-500 text-white py-5 rounded-xl font-bold hover:bg-emerald-600 shadow-lg">生成對標方案</button>
          </div>
        ) : (
          <div className="space-y-12">
            {recommendations && (
              <section className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl">
                <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase mb-2 block">建議首選方案</span>
                <h2 className="text-3xl font-black mb-8">{recommendations.bestMatch.系統名稱}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">預期減碳</p>
                    <p className="text-xl font-black">{formatDbValue(recommendations.bestMatch.c_碳減量中位數)} <span className="text-[10px]">噸</span></p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">投資成本</p>
                    <p className="text-xl font-black">{formatDbValue(recommendations.bestMatch.c_投資成本中位數)} <span className="text-[10px]">萬</span></p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">回收年限</p>
                    <p className="text-xl font-black">{formatDbValue(recommendations.bestMatch.c_回收年限中位數)} <span className="text-[10px]">年</span></p>
                  </div>
                  <button onClick={() => window.open('https://rfq.netellus.com/rfq/create', '_blank')} className="bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-400 transition-all text-sm">獲取報價</button>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black mb-6">產業能耗分佈</h3>
                <div className="h-64 w-full relative mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={systemDistribution} dataKey="percentage" cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" paddingAngle={5} onClick={(_, idx) => setSelectedSystem(systemDistribution[idx].name)}>
                        {systemDistribution.map((e: any, i: number) => <Cell key={i} fill={selectedSystem === e.name ? '#10b981' : '#f1f5f9'} className="cursor-pointer" />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black text-slate-900">{systemDistribution.find(s => s.name === selectedSystem)?.percentage || 0}%</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">系統佔比</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {systemDistribution.map(sys => (
                    <button key={sys.name} onClick={() => { setSelectedSystem(sys.name); setSelectedMeasure(null); }} className={`w-full p-4 rounded-xl text-left flex justify-between items-center font-bold border-2 transition-all ${selectedSystem === sys.name ? 'border-emerald-500 bg-emerald-50' : 'border-slate-50'}`}>
                      <span className="text-xs">{sys.name}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full">{sys.percentage}%</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[500px]">
                <h3 className="text-lg font-black mb-6">對標措施：{selectedSystem || '請選擇左側系統'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {measureDistribution.map((m: any, i: number) => (
                    <button key={i} onClick={() => setSelectedMeasure(m)} className={`p-6 rounded-2xl text-left border-2 transition-all ${selectedMeasure?.措施類型 === m.措施類型 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-50 bg-slate-50 hover:bg-white'}`}>
                      <p className="font-bold text-sm mb-2">{m.措施類型}</p>
                      <p className="text-[9px] font-bold text-emerald-600 uppercase">普及率 {m["b_措施佔比(同產業×系統)"]}</p>
                    </button>
                  ))}
                </div>
                {selectedMeasure && (
                  <div className="mt-8 pt-8 border-t border-slate-100 animate-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-3 gap-4">
                       <div className="p-4 bg-slate-900 rounded-2xl text-white">
                         <p className="text-[8px] opacity-40 uppercase mb-1">節能潛力</p>
                         <p className="text-lg font-black">{formatDbValue(selectedMeasure.c_節能潛力中位數, 1000)} <span className="text-[9px]">度</span></p>
                       </div>
                       <div className="p-4 bg-slate-900 rounded-2xl text-white">
                         <p className="text-[8px] opacity-40 uppercase mb-1">預計投資</p>
                         <p className="text-lg font-black">{formatDbValue(selectedMeasure.c_投資成本中位數)} <span className="text-[9px]">萬</span></p>
                       </div>
                       <div className="p-4 bg-slate-900 rounded-2xl text-white">
                         <p className="text-[8px] opacity-40 uppercase mb-1">回收期</p>
                         <p className="text-lg font-black">{formatDbValue(selectedMeasure.c_回收年限中位數)} <span className="text-[9px]">年</span></p>
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
