import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DatabaseRow, UserGoal, GoalPath } from './types.ts';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { fetchDatabase } from './services/dataService.ts';

const App: React.FC = () => {
  const [db, setDb] = useState<DatabaseRow[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [industrySearch, setIndustrySearch] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [taxId, setTaxId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const [showGoalSetting, setShowGoalSetting] = useState(false);
  const [userGoal, setUserGoal] = useState<UserGoal | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [goalPath, setGoalPath] = useState<GoalPath>('carbon');
  const [currentVal, setCurrentVal] = useState<string>('');
  const [targetVal, setTargetVal] = useState<string>('');
  const [targetType, setTargetType] = useState<'percentage' | 'absolute'>('percentage');

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

  const formatDisplay = (val: string) => {
    if (!val) return "";
    const num = val.replace(/,/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatDbValue = (val: string, multiplyBy: number = 1) => {
    if (!val) return "0";
    const num = parseFloat(val.replace(/,/g, '')) * multiplyBy;
    if (isNaN(num)) return val;
    return num.toLocaleString('en-US', { 
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    });
  };

  const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const rawVal = e.target.value.replace(/,/g, '');
    if (/^\d*$/.test(rawVal)) {
      setter(rawVal);
    }
  };

  const industries = useMemo(() => Array.from(new Set(db.map(r => r.案例公司產業別))).sort(), [db]);

  const filteredSuggestions = useMemo(() => {
    if (!industrySearch) return [];
    const searchLower = industrySearch.toLowerCase();
    const directMatches = industries.filter(ind => ind.toLowerCase().includes(searchLower));
    return directMatches.length === 0 ? industries.slice(0, 3) : directMatches.slice(0, 8); 
  }, [industrySearch, industries]);

  const systemDistribution = useMemo(() => {
    if (!selectedIndustry) return [];
    const industryRows = db.filter(r => r.案例公司產業別 === selectedIndustry);
    const systemsMap = new Map<string, number>();
    industryRows.forEach(r => {
      const pct = parseFloat(r["a_系統佔比(同產業)"].replace('%', '')) || 0;
      systemsMap.set(r.系統名稱, pct);
    });
    return Array.from(systemsMap.entries()).map(([name, percentage]) => ({ name, percentage }));
  }, [selectedIndustry, db]);

  const measureDistribution = useMemo(() => {
    if (!selectedIndustry || !selectedSystem) return [];
    return db.filter(r => r.案例公司產業別 === selectedIndustry && r.系統名稱 === selectedSystem);
  }, [selectedIndustry, selectedSystem, db]);

  const recommendations = useMemo(() => {
    if (!selectedIndustry || !userGoal || db.length === 0) return null;
    let targetX = userGoal.targetType === 'percentage' 
      ? (parseFloat(currentVal) || 0) * (userGoal.targetValue / 100)
      : userGoal.targetValue;

    const industryActions = db.filter(r => r.案例公司產業別 === selectedIndustry);
    if (industryActions.length === 0) return null;
    const parseNum = (s: string) => parseFloat(s.replace(/,/g, '')) || 0;

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
    if (industries.includes(selectedIndustry) && taxId.length === 8 && phone.length >= 10) {
      setIsProfileComplete(true);
      setShowGoalSetting(true);
    }
  };

  const handleConfirmGoalFixed = () => {
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
    }, 1200);
  };

  if (isDbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-12 rounded-[3.5rem] bg-white/10 backdrop-blur-2xl border border-black/5">
          <div className="w-16 h-16 border-4 border-[#2D9B3A] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-slate-900 font-black uppercase tracking-[0.3em] text-xs">Netellus Loading...</p>
        </div>
      </div>
    );
  }

  const DataItem = ({ label, value, unit, colorClass = "text-white" }: { label: string, value: string, unit: string, colorClass?: string }) => {
    const isZeroInvestment = label === "投資成本" && (value === "0" || value === "0.0");
    return (
      <div className="bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10 relative group/item">
        <p className="text-[8px] sm:text-[9px] font-black text-white/30 uppercase mb-1 tracking-wider">{label}</p>
        <div className="flex items-baseline space-x-1 overflow-hidden">
          <span className={`text-base sm:text-lg font-black tracking-tight truncate ${colorClass}`}>{value}</span>
          {isZeroInvestment && <span className="text-sm font-bold text-amber-400 -mt-2 ml-0.5 cursor-help shrink-0">*</span>}
          <span className="text-[8px] sm:text-[10px] text-white/40 font-bold ml-1 shrink-0">{unit}</span>
        </div>
        {isZeroInvestment && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-800 text-white text-[10px] font-bold rounded-xl opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all z-50 shadow-2xl pointer-events-none border border-white/10 leading-relaxed text-center">
            投資成本為 0，代表僅需透過微調設施設定即可實現效益。
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans text-slate-900 selection:bg-[#43FF59]/30">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-3 bg-white/80 backdrop-blur-[20px] shadow-sm' : 'py-6 bg-transparent'}`}>
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={resetApp}>
            <div className="flex flex-col">
              <span className={`text-3xl font-black tracking-tighter transition-colors ${isScrolled ? 'text-[#2D9B3A]' : 'text-slate-900'}`}>Netellus</span>
              <p className="text-[9px] uppercase tracking-[0.16em] font-bold mt-1 text-[#171918]">永續行動決策工具</p>
            </div>
          </div>
          {isProfileComplete && (
            <button onClick={() => setIsProfileComplete(false)} className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white/60 hover:bg-white transition-colors">修改資料</button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 pt-32 pb-20 max-w-7xl relative z-10">
        {!isProfileComplete ? (
          <div className="flex justify-center animate-in fade-in zoom-in duration-700">
            <div className="bg-white/80 backdrop-blur-3xl p-8 sm:p-16 rounded-[3rem] border border-slate-200 w-full max-w-2xl text-center shadow-xl">
              <div className="inline-block bg-[#43FF59]/10 text-[#2D9B3A] px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6">企業分析入口</div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">對標 15,000+ 真實案例</h2>
              <form onSubmit={handleProfileSubmit} className="space-y-8 mt-10">
                <div className="relative" ref={suggestionRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-left pl-4 mb-2">產業別</label>
                  <input type="text" value={industrySearch} onChange={(e) => { setIndustrySearch(e.target.value); setShowSuggestions(true); setSelectedIndustry(industries.includes(e.target.value) ? e.target.value : ''); }} onFocus={() => setShowSuggestions(true)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-5 font-bold text-slate-800 focus:border-[#43FF59] outline-none text-center" placeholder="搜尋產業..." />
                  {showSuggestions && industrySearch && filteredSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2">
                      {filteredSuggestions.map((ind, i) => (
                        <div key={i} onClick={() => { setSelectedIndustry(ind); setIndustrySearch(ind); setShowSuggestions(false); }} className="px-8 py-4 cursor-pointer hover:bg-[#43FF59]/10 font-bold text-slate-600 text-sm text-left transition-colors">{ind}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <input required type="text" maxLength={8} value={taxId} onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))} className="bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-5 font-bold text-center" placeholder="公司統編" />
                  <input required type="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-5 font-bold text-center" placeholder="聯絡電話" />
                </div>
                <button type="submit" disabled={!industries.includes(selectedIndustry) || taxId.length < 8} className="w-full bg-[#43FF59] text-slate-900 py-6 rounded-3xl font-black text-xl hover:bg-[#32e048] transition-all disabled:opacity-30 active:scale-[0.98]">開始分析</button>
              </form>
            </div>
          </div>
        ) : showGoalSetting ? (
          <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-700">
            <div className="bg-white/80 backdrop-blur-3xl p-10 sm:p-16 rounded-[4rem] border border-slate-200 relative overflow-hidden text-center shadow-2xl">
              {isScanning && <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in"><div className="w-20 h-20 border-8 border-slate-100 border-t-[#43FF59] rounded-full animate-spin mb-8"></div><h3 className="text-3xl font-black">Matching Database...</h3></div>}
              <span className="text-[10px] font-black text-[#2D9B3A] uppercase tracking-[0.4em] mb-4 block">指標設定</span>
              <h2 className="text-4xl sm:text-5xl font-black mb-12 tracking-tight">定義年度目標</h2>
              <div className="flex justify-center gap-4 mb-12">
                <button onClick={() => setGoalPath('carbon')} className={`px-10 py-4 rounded-2xl font-black transition-all ${goalPath === 'carbon' ? 'bg-[#43FF59] text-slate-900' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>減碳</button>
                <button onClick={() => setGoalPath('energy')} className={`px-10 py-4 rounded-2xl font-black transition-all ${goalPath === 'energy' ? 'bg-[#43FF59] text-slate-900' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>節能</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <input type="text" value={formatDisplay(currentVal)} onChange={(e) => handleNumericInput(e, setCurrentVal)} className="bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-6 text-3xl font-black text-center focus:border-[#43FF59] outline-none" placeholder="目前數值" />
                <div className="relative">
                  <input type="text" value={formatDisplay(targetVal)} onChange={(e) => handleNumericInput(e, setTargetVal)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-6 text-3xl font-black text-center focus:border-[#43FF59] outline-none" placeholder="目標" />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">{targetType === 'percentage' ? '%' : (goalPath === 'carbon' ? '噸' : '度')}</span>
                </div>
              </div>
              <button onClick={handleConfirmGoalFixed} className="w-full bg-[#43FF59] py-8 rounded-3xl font-black text-2xl hover:bg-[#32e048] transition-all active:scale-[0.98]">獲取最佳實踐方案</button>
            </div>
          </div>
        ) : (
          <div className="space-y-20 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            {recommendations && (
              <section className="bg-[#0F172A] p-10 sm:p-20 rounded-[4rem] relative overflow-hidden border border-white/10 shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#43FF59]/10 rounded-full blur-[100px]"></div>
                <div className="relative z-10 text-center mb-16">
                  <span className="text-[10px] font-black text-[#43FF59] tracking-[0.5em] mb-4 block">RECOMMENDED</span>
                  <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">年度推薦方案</h2>
                </div>
                <div className="max-w-3xl mx-auto bg-white/5 border border-[#43FF59]/30 p-10 rounded-[3rem] backdrop-blur-xl text-center">
                  <h4 className="text-3xl font-black text-white mb-10">{recommendations.bestMatch.系統名稱}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                    <DataItem label="年減碳量" value={formatDbValue(recommendations.bestMatch.c_碳減量中位數)} unit="噸" />
                    <DataItem label="年節能量" value={formatDbValue(recommendations.bestMatch.c_節能潛力中位數, 1000)} unit="度" />
                    <DataItem label="回收年限" value={formatDbValue(recommendations.bestMatch.c_回收年限中位數)} unit="年" />
                  </div>
                  <button onClick={() => window.open("https://rfq.netellus.com/rfq/create", "_blank")} className="w-full bg-[#43FF59] py-6 rounded-2xl font-black text-xl hover:bg-[#32e048] transition-all active:scale-[0.98]">立即詢價</button>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 bg-white/80 p-8 rounded-[3rem] border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black mb-8 flex items-center"><span className="w-2 h-6 bg-[#43FF59] rounded-full mr-3"></span>產業能耗分佈</h3>
                <div className="h-64 relative mb-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={systemDistribution} dataKey="percentage" cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" paddingAngle={5} onClick={(_, idx) => setSelectedSystem(systemDistribution[idx].name)}>
                        {systemDistribution.map((e, i) => <Cell key={i} fill={selectedSystem === e.name ? '#2D9B3A' : '#F1F5F9'} className="cursor-pointer outline-none transition-all" />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-black text-slate-900">{systemDistribution.find(s => s.name === selectedSystem)?.percentage || 0}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">能耗佔比</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {systemDistribution.map(sys => (
                    <button key={sys.name} onClick={() => { setSelectedSystem(sys.name); setSelectedMeasure(null); }} className={`w-full p-4 rounded-2xl border-2 text-left flex justify-between items-center font-bold transition-all ${selectedSystem === sys.name ? 'border-[#2D9B3A] bg-[#2D9B3A]/5 text-slate-900' : 'border-slate-50 text-slate-500 hover:border-slate-200'}`}>
                      <span className="text-sm">{sys.name}</span><span className="bg-slate-100 px-3 py-1 rounded-full text-[10px]">{sys.percentage}%</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8 space-y-10">
                <div className="bg-white/80 p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-black mb-8 tracking-tight">措施細項：{selectedSystem}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {measureDistribution.map((m, i) => (
                      <button key={i} onClick={() => setSelectedMeasure(m)} className={`p-8 rounded-[2.5rem] border-2 text-left transition-all ${selectedMeasure?.措施類型 === m.措施類型 ? 'border-[#2D9B3A] bg-[#2D9B3A]/5 scale-[1.01]' : 'border-slate-50 bg-slate-50 hover:bg-white hover:border-slate-200'}`}>
                        <h4 className="font-black text-lg mb-4 text-slate-800">{m.措施類型}</h4>
                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          <span>回收期 {formatDbValue(m.c_回收年限中位數)} 年</span>
                          <span className="text-slate-900 font-black">佔比 {m["b_措施佔比(同產業×系統)"]}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedMeasure && (
                  <div className="bg-[#0F172A] p-10 rounded-[3.5rem] text-white animate-in slide-in-from-bottom-8 duration-500 border border-white/10 shadow-2xl">
                    <h3 className="text-2xl font-black text-center mb-10 tracking-tight">節能效益試算</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <DataItem label="年減碳量" value={formatDbValue(selectedMeasure.c_碳減量中位數)} unit="噸" />
                      <DataItem label="年節能量" value={formatDbValue(selectedMeasure.c_節能潛力中位數, 1000)} unit="度" />
                      <DataItem label="投資成本" value={formatDbValue(selectedMeasure.c_投資成本中位數)} unit="萬" />
                      <DataItem label="年省電費" value={formatDbValue(selectedMeasure.c_年節省成本中位數)} unit="萬" />
                      <DataItem label="回收期" value={formatDbValue(selectedMeasure.c_回收年限中位數)} unit="年" />
                      <DataItem label="單位成本" value={formatDbValue(selectedMeasure.c_單位減碳成本中位數)} unit="元/噸" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-20 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest relative z-10">
        <div className="flex justify-center space-x-6 mb-4">
          <span className="hover:text-slate-600 cursor-pointer transition-colors">隱私條款</span>
          <span className="hover:text-slate-600 cursor-pointer transition-colors">服務聲明</span>
        </div>
        © Netellus 2025 All Rights Reserved
      </footer>
    </div>
  );
};

export default App;