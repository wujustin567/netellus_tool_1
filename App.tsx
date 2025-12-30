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
      console.error("Database Connection Error:", err);
      setIsDbLoading(false);
    });
  }, []);

  // 點擊外部關閉下拉選單
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

  const isValidIndustry = useMemo(() => {
    const input = industrySearch.trim();
    return industries.some(ind => ind === input);
  }, [industrySearch, industries]);

  const filteredSuggestions = useMemo(() => {
    const search = industrySearch.toLowerCase().trim();
    if (!search) return industries.slice(0, 10);
    return industries.filter(ind => ind.toLowerCase().includes(search)).slice(0, 10);
  }, [industrySearch, industries]);

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
    }, 1000);
  };

  if (isDbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-12 glass-card rounded-[40px] shadow-xl border border-white">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-slate-900 font-bold tracking-widest uppercase">系統核心載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative font-sans text-slate-900">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200' : 'py-8 bg-transparent'}`}>
        <div className="container mx-auto px-8 flex justify-between items-center">
          <div className="cursor-pointer group flex items-center space-x-3" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-600/20 transform group-hover:rotate-12 transition-all">N</div>
            <span className="text-2xl font-black tracking-tighter text-slate-900">Netellus</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-8 pt-48 pb-32">
        {!isProfileComplete ? (
          <div className="max-w-md mx-auto glass-card p-10 rounded-[48px] shadow-2xl relative z-10 animate-in fade-in zoom-in duration-500">
             <div className="text-center mb-10">
               <h2 className="text-3xl font-black mb-3">產業減碳診斷</h2>
               <p className="text-emerald-700/60 text-xs font-black uppercase tracking-[0.2em]">Sustainability Decision Support</p>
             </div>

             <form onSubmit={handleProfileSubmit} className="space-y-8">
                <div className="relative" ref={suggestionRef}>
                  <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-3 block ml-2">1. 選擇企業產業別</label>
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
                      className={`w-full glass-card border-2 rounded-2xl px-6 py-4.5 font-bold outline-none transition-all text-lg ${isValidIndustry ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 focus:border-emerald-400'}`} 
                      placeholder="例：電子零組件..." 
                    />
                    {isValidIndustry && (
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 scale-125 animate-in zoom-in duration-300">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </div>
                  
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-[60] left-0 right-0 mt-3 glass-card rounded-3xl overflow-y-auto max-h-64 shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-300">
                      {filteredSuggestions.map((ind, i) => (
                        <div 
                          key={i} 
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setIndustrySearch(ind); 
                            setShowSuggestions(false); 
                          }} 
                          className={`px-7 py-4.5 cursor-pointer hover:bg-emerald-600 hover:text-white font-bold text-sm transition-all border-b border-slate-50 last:border-0 ${industrySearch === ind ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'}`}
                        >
                          {ind}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-3 block ml-2">2. 公司統一編號</label>
                  <input 
                    required 
                    type="text" 
                    maxLength={8} 
                    autoComplete="off"
                    value={taxId} 
                    onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))} 
                    className="w-full glass-card border-2 border-slate-100 rounded-2xl px-6 py-4.5 font-bold outline-none focus:border-emerald-400 transition-all text-lg shadow-inner" 
                    placeholder="請輸入 8 位統編" 
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={!isValidIndustry || taxId.length !== 8} 
                    className={`w-full py-6 rounded-3xl font-black shadow-2xl transition-all text-xl relative overflow-hidden group ${isValidIndustry && taxId.length === 8 ? 'bg-slate-900 text-white hover:bg-black hover:-translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    <span className="relative z-10">{isValidIndustry && taxId.length === 8 ? '展開路徑分析' : '完成上方資訊'}</span>
                  </button>
                  {!isValidIndustry && industrySearch.length > 0 && (
                    <p className="text-center text-[10px] font-black text-rose-500 mt-5 uppercase tracking-widest animate-pulse">請從下拉選單選擇產業名稱以利數據精準對標</p>
                  )}
                </div>
             </form>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto glass-card p-12 rounded-[56px] text-center shadow-2xl animate-in fade-in slide-in-from-bottom-12 duration-700 border border-white">
            <h2 className="text-3xl font-black mb-12">設定您的企業年度目標</h2>
            <div className="flex p-2 bg-slate-100 rounded-3xl mb-12 border border-slate-200">
              <button onClick={() => setGoalPath('carbon')} className={`flex-1 py-4 rounded-2xl font-black transition-all ${goalPath === 'carbon' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>碳排放減量 (tCO2e)</button>
              <button onClick={() => setGoalPath('energy')} className={`flex-1 py-4 rounded-2xl font-black transition-all ${goalPath === 'energy' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>電力節省 (kWh)</button>
            </div>
            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="text-left space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">年度基準值</label>
                <input type="number" autoComplete="off" value={currentVal} onChange={(e) => setCurrentVal(e.target.value)} className="w-full glass-card border-2 border-slate-100 rounded-2xl p-6 text-3xl font-black text-center outline-none focus:border-emerald-500 transition-all shadow-inner" placeholder="0" />
              </div>
              <div className="text-left space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">減量目標值</label>
                <input type="number" autoComplete="off" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} className="w-full glass-card border-2 border-slate-100 rounded-2xl p-6 text-3xl font-black text-center outline-none focus:border-emerald-500 transition-all shadow-inner" placeholder="0" />
              </div>
            </div>
            <button onClick={handleConfirmGoal} className="w-full bg-emerald-600 text-white py-8 rounded-[36px] font-black hover:bg-emerald-700 shadow-2xl text-2xl transition-all hover:-translate-y-1 active:scale-95 shadow-emerald-500/20">
              {isScanning ? '正在對標同產業實績大數據...' : '生成減碳建議建議'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;