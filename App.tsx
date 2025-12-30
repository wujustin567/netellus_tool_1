import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { fetchDatabase } from './services/dataService';
import { DatabaseRow, UserGoal, GoalPath } from './types';

const App: React.FC = () => {
  const [db, setDb] = useState<DatabaseRow[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  // Profile State
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
      console.error("Database Error:", err);
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

  const industries = useMemo(() => 
    Array.from(new Set(db.map(r => r.案例公司產業別))).filter(Boolean).sort()
  , [db]);

  const isValidIndustry = useMemo(() => 
    industries.some(ind => ind === industrySearch)
  , [industrySearch, industries]);

  const filteredSuggestions = useMemo(() => {
    const searchLower = industrySearch.toLowerCase().trim();
    if (!searchLower) return industries.slice(0, 10); // 沒輸入時顯示熱門或前幾個
    return industries.filter(ind => ind.toLowerCase().includes(searchLower)).slice(0, 8);
  }, [industrySearch, industries]);

  const systemDistribution = useMemo(() => {
    if (!isValidIndustry || db.length === 0) return [];
    const industryRows = db.filter(r => r.案例公司產業別 === industrySearch);
    const systemsMap = new Map<string, number>();
    industryRows.forEach(r => {
      const pct = parseFloat(r["a_系統佔比(同產業)"]?.replace('%', '')) || 0;
      systemsMap.set(r.系統名稱, pct);
    });
    return Array.from(systemsMap.entries()).map(([name, percentage]) => ({ name, percentage }));
  }, [industrySearch, isValidIndustry, db]);

  const measureDistribution = useMemo(() => {
    if (!isValidIndustry || !selectedSystem || db.length === 0) return [];
    return db.filter(r => r.案例公司產業別 === industrySearch && r.系統名稱 === selectedSystem);
  }, [industrySearch, isValidIndustry, selectedSystem, db]);

  const recommendations = useMemo(() => {
    if (!isValidIndustry || !userGoal || db.length === 0) return null;
    let targetX = userGoal.targetType === 'percentage' 
      ? (parseFloat(currentVal) || 0) * (userGoal.targetValue / 100)
      : userGoal.targetValue;

    const industryActions = db.filter(r => r.案例公司產業別 === industrySearch);
    if (industryActions.length === 0) return null;
    const parseNum = (s: string) => parseFloat(s?.replace(/,/g, '')) || 0;

    const bestMatch = industryActions.reduce((prev, curr) => {
      const isCarbon = userGoal.path === 'carbon';
      const prevVal = isCarbon ? parseNum(prev.c_碳減量中位數) : parseNum(prev.c_節能潛力中位數) * 1000;
      const currVal = isCarbon ? parseNum(curr.c_碳減量中位數) : parseNum(curr.c_節能潛力中位數) * 1000;
      return Math.abs(currVal - targetX) < Math.abs(prevVal - targetX) ? curr : prev;
    });

    return { bestMatch, targetX };
  }, [industrySearch, isValidIndustry, userGoal, db, currentVal]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidIndustry && taxId.length === 8) {
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
        targetType: 'absolute',
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-emerald-700/60 text-[11px] font-black uppercase tracking-widest">載入大數據庫中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative selection:bg-emerald-100">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-4 bg-white/70 backdrop-blur-xl border-b border-slate-200' : 'py-8 bg-transparent'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="cursor-pointer group flex items-center space-x-2" onClick={() => window.location.reload()}>
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black transform group-hover:rotate-12 transition-transform">N</div>
            <span className="text-2xl font-black tracking-tighter text-slate-900">Netellus</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 pt-32 pb-32">
        {!isProfileComplete ? (
          <div className="max-w-md mx-auto glass-panel p-10 rounded-[40px] shadow-2xl border border-white/50 relative z-10">
             <div className="text-center mb-10">
               <h2 className="text-3xl font-black text-slate-900 mb-2">產業路徑診斷</h2>
               <p className="text-slate-500 text-sm font-medium italic">企業減碳首選決策支援工具</p>
             </div>

             <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="relative" ref={suggestionRef}>
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2 block ml-1">1. 選擇產業別</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      autoComplete="off"
                      value={industrySearch} 
                      onChange={(e) => { 
                        setIndustrySearch(e.target.value); 
                        setShowSuggestions(true); 
                      }} 
                      onFocus={() => setShowSuggestions(true)}
                      className={`w-full glass-panel border-2 rounded-2xl px-5 py-4 font-bold outline-none transition-all shadow-inner relative z-20 ${isValidIndustry ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 focus:border-emerald-400 focus:bg-white'}`} 
                      placeholder="輸入關鍵字搜尋，例如：電子..." 
                    />
                    {isValidIndustry && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 z-30 pointer-events-none">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </div>
                  
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-[100] left-0 right-0 mt-3 glass-panel rounded-3xl overflow-y-auto max-h-60 shadow-2xl border border-slate-200/50 animate-in fade-in zoom-in-95 duration-200">
                      {filteredSuggestions.map((ind, i) => (
                        <div 
                          key={i} 
                          onMouseDown={(e) => {
                            // 使用 onMouseDown 防止點擊時觸發 blur 導致選單消失
                            e.preventDefault();
                            setIndustrySearch(ind); 
                            setShowSuggestions(false); 
                          }} 
                          className={`px-6 py-4 cursor-pointer hover:bg-emerald-600 hover:text-white font-bold text-sm transition-colors border-b border-slate-50 last:border-0 ${industrySearch === ind ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'}`}
                        >
                          {ind}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2 block ml-1">2. 公司統一編號</label>
                  <input 
                    required 
                    type="text" 
                    maxLength={8} 
                    autoComplete="off"
                    value={taxId} 
                    onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))} 
                    className="w-full glass-panel border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all shadow-inner relative z-10" 
                    placeholder="請輸入 8 位統編數字" 
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={!isValidIndustry || taxId.length !== 8} 
                    className={`w-full py-5 rounded-2xl font-black shadow-xl transition-all text-lg relative overflow-hidden group ${isValidIndustry && taxId.length === 8 ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:-translate-y-1 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    <span className="relative z-10">{isValidIndustry && taxId.length === 8 ? '進入減碳診斷' : '完成上方資訊以送出'}</span>
                    {(isValidIndustry && taxId.length === 8) && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>}
                  </button>
                  {!isValidIndustry && industrySearch.length > 0 && (
                    <p className="text-center text-[10px] font-bold text-rose-500 mt-4 uppercase tracking-widest animate-pulse">請點擊下拉選單選取確切產業名稱</p>
                  )}
                </div>
             </form>
          </div>
        ) : showGoalSetting ? (
          <div className="max-w-2xl mx-auto glass-panel p-12 rounded-[40px] text-center shadow-2xl border border-white/50 animate-in fade-in slide-in-from-bottom-10 duration-500">
            <h2 className="text-3xl font-black mb-10 text-slate-900">設定您的年度目標</h2>
            <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-10">
              <button onClick={() => setGoalPath('carbon')} className={`flex-1 py-4 rounded-xl font-black transition-all ${goalPath === 'carbon' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>碳排放減量</button>
              <button onClick={() => setGoalPath('energy')} className={`flex-1 py-4 rounded-xl font-black transition-all ${goalPath === 'energy' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>節約總用電</button>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-10">
              <div className="text-left space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">目前基準值 ({goalPath === 'carbon' ? '噸 tCO2e' : '度 kWh'})</label>
                <input type="number" autoComplete="off" value={currentVal} onChange={(e) => setCurrentVal(e.target.value)} className="w-full glass-panel border-2 border-slate-100 rounded-2xl p-5 text-2xl font-black text-center outline-none focus:border-emerald-500 transition-all" placeholder="0" />
              </div>
              <div className="text-left space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">年度目標值 ({goalPath === 'carbon' ? '噸 tCO2e' : '度 kWh'})</label>
                <input type="number" autoComplete="off" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} className="w-full glass-panel border-2 border-slate-100 rounded-2xl p-5 text-2xl font-black text-center outline-none focus:border-emerald-500 transition-all" placeholder="0" />
              </div>
            </div>
            <button onClick={handleConfirmGoal} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black hover:bg-emerald-700 shadow-2xl text-xl transition-all hover:-translate-y-1 active:scale-95">
              {isScanning ? '正在對標大數據...' : '生成減碳路徑建議'}
            </button>
          </div>
        ) : (
          <div className="space-y-12 max-w-6xl mx-auto animate-in fade-in duration-700">
            {recommendations && (
              <section className="bg-slate-900 p-10 rounded-[50px] text-white shadow-3xl overflow-hidden relative border border-white/5">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 blur-[120px] rounded-full -mr-20 -mt-20"></div>
                <div className="relative z-10">
                  <span className="inline-block px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-black text-emerald-400 tracking-widest uppercase mb-6">對標分析結果：首選建議系統</span>
                  <h2 className="text-4xl md:text-5xl font-black mb-12 leading-tight">依據您的產業屬性，<br/>建議優先建置：<span className="text-emerald-400">{recommendations.bestMatch.系統名稱}</span></h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-white/5 p-7 rounded-[32px] border border-white/10 backdrop-blur-md">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">預期年減量</p>
                      <p className="text-3xl font-black text-emerald-50">{formatDbValue(recommendations.bestMatch.c_碳減量中位數)} <span className="text-sm font-medium opacity-40">tCO2e</span></p>
                    </div>
                    <div className="bg-white/5 p-7 rounded-[32px] border border-white/10 backdrop-blur-md">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">預估投資成本</p>
                      <p className="text-3xl font-black text-emerald-50">{formatDbValue(recommendations.bestMatch.c_投資成本中位數)} <span className="text-sm font-medium opacity-40">萬</span></p>
                    </div>
                    <div className="bg-white/5 p-7 rounded-[32px] border border-white/10 backdrop-blur-md">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">平均回收期</p>
                      <p className="text-3xl font-black text-emerald-50">{formatDbValue(recommendations.bestMatch.c_回收年限中位數)} <span className="text-sm font-medium opacity-40">年</span></p>
                    </div>
                    <button onClick={() => window.open('https://rfq.netellus.com/rfq/create', '_blank')} className="bg-emerald-500 text-white rounded-[32px] font-black hover:bg-emerald-400 transition-all text-sm shadow-xl shadow-emerald-500/20 group relative overflow-hidden">
                      <span className="relative z-10">獲取供應商報價</span>
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                  </div>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 glass-panel p-10 rounded-[40px] border border-white/60 shadow-xl">
                <h3 className="text-xl font-black mb-10 text-slate-800 border-l-4 border-emerald-500 pl-4">產業能耗分佈</h3>
                <div className="h-64 w-full relative mb-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={systemDistribution} dataKey="percentage" cx="50%" cy="50%" innerRadius="75%" outerRadius="95%" paddingAngle={8} onClick={(_, idx) => {
                        setSelectedSystem(systemDistribution[idx].name);
                        setSelectedMeasure(null);
                      }}>
                        {systemDistribution.map((e: any, i: number) => <Cell key={i} fill={selectedSystem === e.name ? '#10b981' : '#f1f5f9'} stroke="none" className="outline-none cursor-pointer" />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-5xl font-black text-slate-900">{systemDistribution.find(s => s.name === selectedSystem)?.percentage || 0}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">電力佔比</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {systemDistribution.map(sys => (
                    <button key={sys.name} onClick={() => { setSelectedSystem(sys.name); setSelectedMeasure(null); }} className={`w-full p-6 rounded-2xl text-left flex justify-between items-center font-black border-2 transition-all ${selectedSystem === sys.name ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md scale-[1.02]' : 'border-slate-50 text-slate-500 hover:border-slate-200'}`}>
                      <span className="text-sm">{sys.name}</span>
                      <span className="text-xs bg-white px-3 py-1.5 rounded-full shadow-sm">{sys.percentage}%</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8 glass-panel p-10 rounded-[40px] border border-white/60 shadow-xl min-h-[650px]">
                <div className="flex justify-between items-center mb-12">
                  <h3 className="text-2xl font-black text-slate-800">可對標減量措施：<span className="text-emerald-600">{selectedSystem || '未選擇系統'}</span></h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {measureDistribution.length > 0 ? measureDistribution.map((m: any, i: number) => (
                    <button key={i} onClick={() => setSelectedMeasure(m)} className={`p-8 rounded-[32px] text-left border-2 transition-all relative overflow-hidden group ${selectedMeasure?.措施類型 === m.措施類型 ? 'border-emerald-500 bg-emerald-50 ring-8 ring-emerald-500/5' : 'border-slate-50 bg-slate-50/50 hover:bg-white hover:border-slate-200 shadow-sm'}`}>
                      <p className="font-black text-slate-900 text-lg mb-4">{m.措施類型}</p>
                      <div className="flex items-center">
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider">產業普及率 {m["b_措施佔比(同產業×系統)"]}</span>
                      </div>
                    </button>
                  )) : (
                    <div className="col-span-2 flex items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-[40px]">
                      <p className="text-slate-400 font-bold">請先從左側選擇能源系統以查看對標措施</p>
                    </div>
                  )}
                </div>

                {selectedMeasure && (
                  <div className="mt-14 pt-12 border-t-2 border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <div className="grid grid-cols-3 gap-6">
                       <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 blur-2xl rounded-full"></div>
                         <p className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-3">預估節電潛力</p>
                         <p className="text-3xl font-black text-emerald-50">{formatDbValue(selectedMeasure.c_節能潛力中位數, 1000)} <span className="text-xs font-medium opacity-40">kWh</span></p>
                       </div>
                       <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 blur-2xl rounded-full"></div>
                         <p className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-3">平均投資金額</p>
                         <p className="text-3xl font-black text-emerald-50">{formatDbValue(selectedMeasure.c_投資成本中位數)} <span className="text-xs font-medium opacity-40">萬 TWD</span></p>
                       </div>
                       <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 blur-2xl rounded-full"></div>
                         <p className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-3">單位減碳成本</p>
                         <p className="text-3xl font-black text-emerald-50">{formatDbValue(selectedMeasure.c_單位減碳成本中位數)} <span className="text-xs font-medium opacity-40">元/t</span></p>
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