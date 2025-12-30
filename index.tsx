import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';

// --- 1. TYPES DEFINITION (合併自 types.ts) ---
export interface DatabaseRow {
  案例公司產業別: string;
  系統名稱: string;
  措施類型: string;
  "a_系統佔比(同產業)": string;
  "b_措施佔比(同產業×系統)": string;
  c_碳減量中位數: string;
  c_節能潛力中位數: string;
  c_投資成本中位數: string;
  c_年節省成本中位數: string;
  c_回收年限中位數: string;
  c_單位減碳成本中位數: string;
  [key: string]: string;
}

export type GoalPath = 'carbon' | 'energy';

export interface UserGoal {
  path: GoalPath;
  currentValue: number;
  targetType: 'percentage' | 'absolute';
  targetValue: number;
}

// --- 2. DATA SERVICE (合併自 services/dataService.ts) ---
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1RH52lJntYqVS-WW9iVsqFxtN9uWJY7k4Noipt3Tn-qU/gviz/tq?tqx=out:csv&sheet=%E7%B5%90%E6%9E%9C%E7%B8%BD%E8%A1%A8";

async function fetchDatabase(): Promise<DatabaseRow[]> {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error("無法連接到資料庫");
    const text = await response.text();
    
    // 簡易 CSV 解析 (處理引號與逗號)
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const parseLine = (line: string) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1)
      .filter(line => line.trim() !== "")
      .map(line => {
        const values = parseLine(line);
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = values[i] || "";
        });
        return obj as DatabaseRow;
      });

    return rows;
  } catch (error) {
    console.error("Database fetch error:", error);
    return [];
  }
}

// --- 3. MAIN APP COMPONENT (合併自 App.tsx) ---
const App: React.FC = () => {
  // Database State
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

  // 監聽捲動事件以切換 Header 樣式
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 初始化資料庫
  useEffect(() => {
    fetchDatabase().then(data => {
      setDb(data);
      setIsDbLoading(false);
    });
  }, []);

  // 點擊外部關閉建議清單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 重置應用程式回到第一階段
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

  // 輔助函式：輸入時數字格式化
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

  // 提取產業列表
  const industries = useMemo(() => Array.from(new Set(db.map(r => r.案例公司產業別))).sort(), [db]);

  // 搜尋建議邏輯
  const filteredSuggestions = useMemo(() => {
    if (!industrySearch) return [];
    const searchLower = industrySearch.toLowerCase();
    const directMatches = industries.filter(ind => ind.toLowerCase().includes(searchLower));
    return directMatches.length === 0 ? industries.slice(0, 3) : directMatches.slice(0, 8); 
  }, [industrySearch, industries]);

  // 提取系統佔比
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

  // 提取措施佔比
  const measureDistribution = useMemo(() => {
    if (!selectedIndustry || !selectedSystem) return [];
    return db.filter(r => r.案例公司產業別 === selectedIndustry && r.系統名稱 === selectedSystem);
  }, [selectedIndustry, selectedSystem, db]);

  // 推薦邏輯
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
    const isZeroInvestment = label === "投資成本" && value === "0";
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
            投資成本為 0，代表僅需透過微調設施設定與運作合理性即可實現節能減碳效益。
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans text-slate-900 selection:bg-[#43FF59]/30">
      
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-3 sm:py-4 bg-white/80 backdrop-blur-[20px] shadow-sm' : 'py-6 sm:py-8 bg-transparent'}`}>
        <div className="container mx-auto px-4 sm:px-8 flex justify-between items-center">
          <div className="flex items-center cursor-pointer group" onClick={resetApp}>
            <div className="flex flex-col items-start">
              <span className={`text-3xl sm:text-4xl font-black tracking-tighter transition-all duration-300 ${isScrolled ? 'text-[#2D9B3A]' : 'text-slate-900'}`}>Netellus</span>
              <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.16em] font-bold mt-1 transition-colors duration-300 text-[#171918]">永續行動決策工具</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 sm:space-x-8">
            {isProfileComplete && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-800 tracking-widest uppercase">{selectedIndustry}</span>
                <span className="text-[8px] font-bold text-[#171918] tracking-widest uppercase">TAX ID: {taxId}</span>
              </div>
            )}
            
            {isProfileComplete && (
              <button 
                onClick={() => setIsProfileComplete(false)}
                className={`px-4 sm:px-6 py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 ${isScrolled ? 'bg-[#2D9B3A] border-[#2D9B3A] text-white' : 'bg-white/60 border-slate-200 text-slate-800'}`}
              >
                修改資料
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-32 sm:pt-48 pb-20 max-w-7xl relative z-10">
        
        {!isProfileComplete ? (
          <div className="flex-grow flex items-center justify-center animate-in fade-in zoom-in duration-1000">
            <div className="bg-white/80 backdrop-blur-3xl p-8 sm:p-12 md:p-16 rounded-[2.5rem] sm:rounded-[4rem] border border-slate-200 w-full max-w-2xl">
              <div className="text-center mb-8 sm:mb-12">
                <div className="inline-block bg-[#43FF59]/10 text-[#2D9B3A] px-4 sm:px-6 py-2 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] mb-4 sm:mb-6">企業分析入口</div>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">對標 15,000+ 真實減碳案例</h2>
                <p className="text-slate-400 font-bold text-sm sm:text-base">Netellus 雲端實績資料庫決策系統</p>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-6 sm:space-y-8">
                <div className="space-y-2 sm:space-y-3 relative" ref={suggestionRef}>
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">搜尋您的產業別</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="例如：電子零組件、紡織..."
                      value={industrySearch}
                      onChange={(e) => {
                        setIndustrySearch(e.target.value);
                        setShowSuggestions(true);
                        setSelectedIndustry(industries.includes(e.target.value) ? e.target.value : '');
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl sm:rounded-3xl px-6 sm:px-8 py-4 sm:py-5 font-bold text-slate-800 focus:outline-none focus:border-[#43FF59] transition-all text-center placeholder:text-slate-300 text-base sm:text-lg"
                    />
                  </div>
                  {showSuggestions && industrySearch && (
                    <div className="absolute z-[60] left-0 right-0 mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden animate-in fade-in slide-in-from-top-4">
                      <ul className="max-h-60 overflow-y-auto">
                        {filteredSuggestions.map((ind, i) => (
                          <li key={i} onClick={() => { setSelectedIndustry(ind); setIndustrySearch(ind); setShowSuggestions(false); }} className={`px-6 sm:px-8 py-3 sm:py-4 cursor-pointer text-xs sm:text-sm font-bold flex justify-between items-center transition-colors hover:bg-[#43FF59]/10 ${selectedIndustry === ind ? 'bg-[#43FF59]/5 text-[#2D9B3A]' : 'text-slate-600'}`}>
                            <span>{ind}</span>
                            {selectedIndustry === ind && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">公司統編</label>
                    <input required type="text" maxLength={8} value={taxId} onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl sm:rounded-3xl px-6 sm:px-8 py-4 sm:py-5 font-bold text-slate-800 focus:outline-none focus:border-[#43FF59] text-center text-base sm:text-lg" placeholder="8 位數字" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">聯絡電話</label>
                    <input required type="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl sm:rounded-3xl px-6 sm:px-8 py-4 sm:py-5 font-bold text-slate-800 focus:outline-none focus:border-[#43FF59] text-center text-base sm:text-lg" placeholder="09xx-xxx-xxx" />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={!industries.includes(selectedIndustry) || taxId.length < 8 || phone.length < 10} 
                  className="w-full bg-[#43FF59] text-slate-900 py-5 sm:py-6 rounded-2xl sm:rounded-3xl font-black text-xl sm:text-2xl border border-[#32e048] hover:bg-[#32e048] transition-all disabled:opacity-20 mt-4 sm:mt-6 active:scale-95"
                >
                  開始探索永續行動
                </button>
              </form>
            </div>
          </div>
        ) : showGoalSetting ? (
          <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-700 flex-grow flex items-center relative">
            <div className="bg-white/80 backdrop-blur-3xl p-8 sm:p-12 md:p-16 rounded-[2.5rem] sm:rounded-[4rem] border border-slate-200 w-full relative overflow-hidden">
              <button onClick={() => setIsProfileComplete(false)} className="absolute top-6 left-6 sm:top-10 sm:left-10 z-20 p-3 sm:p-4 bg-slate-50 hover:bg-slate-100 rounded-xl sm:rounded-2xl transition-all text-slate-400"><svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
              
              {isScanning && (
                <div className="absolute inset-0 z-50 bg-transparent backdrop-blur-2xl flex flex-col items-center justify-center text-center px-10 transition-all duration-500 animate-in fade-in">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 border-[6px] sm:border-[8px] border-slate-100/30 border-t-[#43FF59] rounded-full animate-spin mb-8 sm:mb-10 shadow-[0_0_30px_rgba(67,255,89,0.2)]"></div>
                  <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight italic drop-shadow-sm">Matching Cloud Database...</h3>
                  <p className="mt-4 text-slate-500 font-bold text-xs sm:text-sm tracking-widest uppercase opacity-60">Synchronizing industrial benchmarks</p>
                </div>
              )}

              <div className="text-center mb-10 sm:mb-16">
                <span className="text-[9px] sm:text-[10px] font-black text-[#2D9B3A] uppercase tracking-[0.4em] mb-3 sm:mb-4 block">年度減碳指標設定</span>
                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mb-4 sm:mb-6 tracking-tight">定義您的目標基準</h2>
              </div>
              
              <div className="flex flex-col md:flex-row justify-center items-center gap-6 sm:gap-8 mb-10 sm:mb-16">
                <div className="flex bg-slate-100 p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl">
                  <button onClick={() => setGoalPath('carbon')} className={`px-8 sm:px-12 py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm transition-all ${goalPath === 'carbon' ? 'bg-[#43FF59] text-slate-900' : 'text-slate-400'}`}>減碳路徑</button>
                  <button onClick={() => setGoalPath('energy')} className={`px-8 sm:px-12 py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm transition-all ${goalPath === 'energy' ? 'bg-[#43FF59] text-slate-900' : 'text-slate-400'}`}>節能路徑</button>
                </div>
                <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
                <button 
                  onClick={() => { 
                    setUserGoal(null); 
                    setShowGoalSetting(false); 
                    if (systemDistribution.length > 0) setSelectedSystem(systemDistribution[0].name); 
                  }} 
                  className="px-8 py-4 rounded-2xl text-slate-400 font-black text-xs sm:text-sm hover:text-slate-600 border-2 border-dashed border-slate-200 transition-all"
                >
                  暫無目標，直接進入洞察
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 mb-10 sm:mb-16">
                <div className="space-y-3">
                  <div className="flex items-center px-4 mb-1 h-[42px]">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">目前年{goalPath === 'carbon' ? '排放' : '用電'}量</label>
                  </div>
                  <input type="text" value={formatDisplay(currentVal)} onChange={(e) => handleNumericInput(e, setCurrentVal)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl sm:rounded-[2.5rem] px-8 sm:px-10 py-6 sm:py-8 text-3xl sm:text-4xl font-black text-slate-900 focus:outline-none focus:border-[#43FF59]" placeholder="0" />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center px-4 mb-1 h-[42px]">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">年度目標值</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setTargetType('percentage')} className={`px-3 py-1 rounded-md text-[9px] font-black transition-all ${targetType === 'percentage' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>%</button>
                      <button onClick={() => setTargetType('absolute')} className={`px-3 py-1 rounded-md text-[9px] font-black transition-all ${targetType === 'absolute' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>數值</button>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="text" value={formatDisplay(targetVal)} onChange={(e) => handleNumericInput(e, setTargetVal)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl sm:rounded-[2.5rem] px-8 sm:px-10 py-6 sm:py-8 text-3xl sm:text-4xl font-black text-slate-900 focus:outline-none focus:border-[#43FF59]" placeholder="Target" />
                    <span className="absolute right-8 sm:right-10 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl sm:text-2xl uppercase select-none">
                      {targetType === 'percentage' ? '%' : (goalPath === 'carbon' ? '噸' : '度')}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={handleConfirmGoalFixed} className="w-full bg-[#43FF59] text-slate-900 py-6 sm:py-8 rounded-2xl sm:rounded-[2.5rem] font-black text-xl sm:text-2xl border border-[#32e048] hover:bg-[#32e048] transition-all active:scale-95">獲取最佳實踐方案</button>
            </div>
          </div>
        ) : (
          <div className="space-y-10 sm:space-y-20 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-3xl p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-200">
              <div className="flex items-center space-x-2 sm:space-x-3 text-[9px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest pl-2 sm:pl-4">
                <span className="text-[#2D9B3A]">決策支援</span><span className="text-slate-300">/</span><span>{selectedIndustry}</span>
              </div>
              <button onClick={() => setShowGoalSetting(true)} className="px-5 sm:px-8 py-2.5 sm:py-3 bg-[#43FF59] text-slate-900 text-[10px] sm:text-xs font-black rounded-xl sm:rounded-2xl border border-[#32e048] flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 15l-3-3m0 0l3-3m-3 3h8" /></svg>重新設定
              </button>
            </div>

            {recommendations && (
              <section className="bg-[#0F172A] p-8 sm:p-14 md:p-20 rounded-[2.5rem] sm:rounded-[5rem] relative overflow-hidden border border-white/10 shadow-2xl">
                <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-[#43FF59]/10 rounded-full -mr-[25rem] -mt-[25rem] blur-[150px]"></div>
                <div className="relative z-10 mb-10 sm:mb-16 text-center px-4">
                  <span className="text-[9px] sm:text-[11px] font-black text-[#43FF59] uppercase tracking-[0.4em] sm:tracking-[0.6em] mb-3 sm:mb-4 block italic">匹配成功</span>
                  <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">推薦方案</h2>
                  <p className="text-white/50 font-bold mt-3 sm:mt-4 text-sm sm:text-lg">
                    目標：年度 {userGoal?.path === 'carbon' ? '減量' : '節能'} {Math.round(recommendations.targetX).toLocaleString()} {userGoal?.path === 'carbon' ? '噸' : '度'}
                  </p>
                </div>
                
                <div className="flex justify-center">
                  <div className="p-6 sm:p-10 rounded-[2rem] sm:rounded-[4rem] border-2 flex flex-col transition-all relative overflow-hidden group w-full max-w-3xl bg-white/5 border-[#43FF59]/30 backdrop-blur-xl">
                    <span className="bg-[#43FF59] text-slate-900 text-[9px] sm:text-[10px] font-black px-4 sm:px-6 py-2 rounded-full uppercase tracking-widest mb-6 sm:mb-10 self-center">推薦永續行動</span>
                    <h4 className="text-3xl sm:text-5xl font-black text-white mb-8 sm:mb-10 text-center leading-tight">
                      {recommendations.bestMatch.系統名稱} 
                      <span className="text-white/30 text-xs sm:text-base font-bold block mt-2 sm:mt-3">({recommendations.bestMatch.措施類型})</span>
                    </h4>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-10 sm:mb-14">
                      <DataItem label="年減碳量" value={formatDbValue(recommendations.bestMatch.c_碳減量中位數)} unit="噸/年" colorClass="text-white" />
                      <DataItem label="年節能量" value={formatDbValue(recommendations.bestMatch.c_節能潛力中位數, 1000)} unit="度/年" colorClass="text-white" />
                      <DataItem label="投資成本" value={formatDbValue(recommendations.bestMatch.c_投資成本中位數)} unit="萬元" colorClass="text-white" />
                      <DataItem label="年省成本" value={formatDbValue(recommendations.bestMatch.c_年節省成本中位數)} unit="萬元/年" colorClass="text-white" />
                      <DataItem label="回收年限" value={formatDbValue(recommendations.bestMatch.c_回收年限中位數)} unit="年" colorClass="text-white" />
                      <DataItem label="單位減碳成本" value={formatDbValue(recommendations.bestMatch.c_單位減碳成本中位數)} unit="元/噸" colorClass="text-white" />
                    </div>

                    <button 
                      onClick={() => { window.open("https://rfq.netellus.com/rfq/create", "_blank"); }} 
                      className="w-full bg-[#43FF59] text-slate-900 py-6 sm:py-8 rounded-xl sm:rounded-[2rem] font-black text-xl sm:text-2xl border border-[#32e048] hover:bg-[#32e048] transition-all active:scale-95"
                    >
                      立即取得精準報價
                    </button>
                  </div>
                </div>
              </section>
            )}

            <div id="market-consensus" className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-16">
              <div className="lg:col-span-4 space-y-8 sm:space-y-12">
                <div className="bg-white/80 backdrop-blur-3xl p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[4rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 mb-8 sm:mb-12 flex items-center tracking-tight"><span className="w-2.5 h-6 sm:w-3 sm:h-8 bg-[#43FF59] rounded-full mr-4 sm:mr-5"></span>產業能耗佔比</h3>
                  <div className="h-64 sm:h-80 relative mb-8 sm:mb-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie 
                          data={systemDistribution} 
                          dataKey="percentage" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          innerRadius="72%" 
                          outerRadius="95%" 
                          paddingAngle={6}
                          cornerRadius={12}
                          stroke="none"
                          onClick={(_, idx) => { setSelectedSystem(systemDistribution[idx].name); setSelectedMeasure(null); }}
                        >
                          {systemDistribution.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={selectedSystem === entry.name ? '#2D9B3A' : '#F1F5F9'} 
                              className="cursor-pointer outline-none transition-all duration-300" 
                            />
                          ))}
                        </Pie>
                        <Tooltip content={() => null} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-10">
                      <div className="text-center">
                        <span className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-none block mb-1">
                          {systemDistribution.find(s => s.name === selectedSystem)?.percentage || 0}%
                        </span>
                        <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                          能耗佔比
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    {systemDistribution.map(sys => (
                      <button key={sys.name} onClick={() => { setSelectedSystem(sys.name); setSelectedMeasure(null); }} className={`w-full text-left p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border-2 transition-all flex justify-between items-center ${selectedSystem === sys.name ? 'border-[#2D9B3A] bg-[#2D9B3A]/5 text-slate-900' : 'border-slate-50 text-slate-600 hover:border-[#2D9B3A]/30'}`}>
                        <span className="font-bold text-sm sm:text-base tracking-tight">{sys.name}</span>
                        <span className="text-[10px] sm:text-xs font-black px-3 py-1 sm:px-4 sm:py-1.5 bg-slate-100 rounded-full">{sys.percentage}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-10 sm:space-y-16">
                <div className="bg-white/80 backdrop-blur-3xl p-8 sm:p-14 rounded-[2.5rem] sm:rounded-[4rem] border border-slate-200">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mb-8 sm:mb-12">措施細分選項：{selectedSystem}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                    {measureDistribution.map((measure, index) => (
                      <button key={index} onClick={() => setSelectedMeasure(measure)} className={`p-6 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] border-2 text-left transition-all relative overflow-hidden ${selectedMeasure?.措施類型 === measure.措施類型 ? 'border-[#2D9B3A] bg-[#2D9B3A]/5 scale-[1.01]' : 'border-slate-50 bg-slate-50 hover:border-[#2D9B3A]/30 hover:bg-white'}`}>
                        <h4 className="font-black text-slate-800 mb-6 sm:mb-8 text-xl sm:text-2xl leading-tight">{measure.措施類型}</h4>
                        <div className="flex justify-between items-end">
                          <div><p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase mb-1">同類佔比</p><p className="text-lg sm:text-xl font-black">{measure["b_措施佔比(同產業×系統)"]}</p></div>
                          <div className="text-right"><p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase mb-1">回收期</p><p className="text-lg sm:text-xl font-black text-amber-600">{formatDbValue(measure.c_回收年限中位數)} 年</p></div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedMeasure ? (
                  <div className="space-y-10 sm:space-y-16 animate-in slide-in-from-bottom-12 duration-700">
                    <div className="bg-[#0F172A] p-6 sm:p-14 rounded-[2.5rem] sm:rounded-[5rem] text-white border border-white/10 relative overflow-hidden shadow-2xl">
                      <div className="mb-8 sm:mb-14 text-center">
                        <h3 className="text-2xl sm:text-3xl font-black mb-2 px-4">節能措施成效試算</h3>
                        <p className="text-white/40 text-[9px] sm:text-[10px] font-bold tracking-widest uppercase italic">依據篩選條件之中位數分析</p>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                        {[
                          { l: "年減碳量", l_en: "Reduction", v: formatDbValue(selectedMeasure.c_碳減量中位數), u: "噸/年", c: "text-white" },
                          { l: "年節能量", l_en: "Savings", v: formatDbValue(selectedMeasure.c_節能潛力中位數, 1000), u: "度/年", c: "text-white" },
                          { l: "投資成本", l_en: "CAPEX", v: formatDbValue(selectedMeasure.c_投資成本中位數), u: "萬元", c: "text-white" },
                          { l: "年省成本", l_en: "Savings", v: formatDbValue(selectedMeasure.c_年節省成本中位數), u: "萬元/年", c: "text-white" },
                          { l: "回收年限", l_en: "ROI Period", v: formatDbValue(selectedMeasure.c_回收年限中位數), u: "年", c: "text-white" },
                          { l: "單位碳成本", l_en: "Cost/Ton", v: formatDbValue(selectedMeasure.c_單位減碳成本中位數), u: "元/噸", c: "text-white" },
                        ].map((item, i) => (
                          <div key={i} className="bg-white/5 p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] border border-white/10 group/item hover:bg-white/10 transition-colors flex flex-col justify-between relative overflow-hidden">
                            <div>
                              <p className={`${item.c} text-[9px] sm:text-[11px] font-black uppercase mb-0.5 sm:mb-1 tracking-[0.1em] sm:tracking-[0.2em]`}>{item.l}</p>
                              <p className="text-white/30 text-[7px] sm:text-[8px] font-bold uppercase tracking-widest mb-3 sm:mb-4">{item.l_en}</p>
                            </div>
                            <div className="flex items-baseline flex-wrap gap-x-1 sm:gap-x-2">
                              <span className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight leading-none truncate max-w-full">{item.v}</span>
                              {item.l === "投資成本" && item.v === "0" && (
                                <span className="text-xs font-bold text-amber-400 -mt-2 cursor-help">*</span>
                              )}
                              <span className="text-[8px] sm:text-xs text-white/30 font-bold uppercase leading-none shrink-0">{item.u}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#43FF59] p-10 sm:p-20 rounded-[2.5rem] sm:rounded-[5rem] text-slate-900 flex flex-col lg:flex-row items-center justify-between gap-10 sm:gap-16 relative overflow-hidden shadow-xl">
                      <div className="max-w-xl relative z-10 text-center lg:text-left">
                        <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.5em] mb-4 sm:mb-8 block opacity-60">Procurement Action</span>
                        <h3 className="text-3xl sm:text-4xl font-black mb-4 sm:mb-6 tracking-tight leading-tight">免費尋找服務商</h3>
                        <p className="text-slate-800 font-bold text-base sm:text-lg leading-relaxed">我們將為您免費推薦符合您需求的合格供應商。</p>
                      </div>
                      <button onClick={() => { window.open("https://rfq.netellus.com/rfq/create", "_blank"); }} className="w-full sm:w-auto whitespace-nowrap bg-slate-900 text-[#43FF59] px-8 py-6 sm:px-20 sm:py-10 rounded-2xl sm:rounded-[3rem] font-black text-xl sm:text-3xl border border-black hover:bg-black transition-all active:scale-95 flex items-center justify-center group relative z-10">
                        獲取專屬報價單<svg className="w-6 h-6 sm:w-12 sm:h-12 ml-4 sm:ml-8 group-hover:translate-x-3 sm:group-hover:translate-x-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/40 backdrop-blur-xl border-4 border-dashed border-slate-200 rounded-[2.5rem] sm:rounded-[5rem] p-24 sm:p-48 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 sm:w-32 sm:h-32 bg-slate-100 rounded-full mb-8 sm:mb-12 flex items-center justify-center text-slate-300"><svg className="w-10 h-10 sm:w-16 sm:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></div>
                    <h4 className="text-xl sm:text-3xl font-black text-slate-300 italic tracking-tight opacity-70 px-4">選擇具體措施以深入對標</h4>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 sm:mt-40 py-20 sm:py-32 bg-transparent text-center relative z-10 flex flex-col items-center space-y-2">
        <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest px-4 opacity-70">
          <a href="https://rfq.netellus.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 transition-colors">Privacy policy</a>
          <span className="mx-2">|</span>
          <a href="https://rfq.netellus.com/terms" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 transition-colors">Terms</a>
          <span className="ml-2">All Rights Reserved</span>
        </div>
        <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-4 opacity-60">
          © Netellus 2025
        </p>
      </footer>
    </div>
  );
};

// --- 4. RENDER ROOT ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);