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
  const [phone, setPhone] = useState<string>('');
  const [taxId, setTaxId] = useState<string>('');
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Phase 1.5 Goal Setting State
  const [goalMode, setGoalMode] = useState<'unset' | 'has_goal' | 'no_goal' | 'has_goal_input'>('unset');
  const [userGoal, setUserGoal] = useState<UserGoal | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const [goalPath, setGoalPath] = useState<GoalPath>('carbon');
  // Visual Spec: Prioritize Percentage
  const [targetMethod, setTargetMethod] = useState<'percentage' | 'absolute'>('percentage');
  
  const [currentVal, setCurrentVal] = useState<string>('');
  const [targetVal, setTargetVal] = useState<string>(''); 

  // UI State
  const [selectedAction, setSelectedAction] = useState<DatabaseRow | null>(null);

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

  const isValidIndustry = useMemo(() => {
    const input = industrySearch.trim();
    return industries.some(ind => ind === input);
  }, [industrySearch, industries]);

  const filteredSuggestions = useMemo(() => {
    const search = industrySearch.toLowerCase().trim();
    if (!search) return industries.slice(0, 10);
    return industries.filter(ind => ind.toLowerCase().includes(search)).slice(0, 10);
  }, [industrySearch, industries]);

  // Phone Validation Logic
  const isPhoneValid = useMemo(() => {
      return phone.startsWith('09') && phone.length === 10;
  }, [phone]);

  // Data Analysis & Stats
  const industryStats = useMemo(() => {
    if (!isValidIndustry) return [];
    return db.filter(r => r.案例公司產業別 === industrySearch);
  }, [db, industrySearch, isValidIndustry]);

  // Phase 2 Optimization: Full data for Chart, Top 5 for List
  const systemDistribution = useMemo(() => {
    const systems: Record<string, number> = {};
    industryStats.forEach(row => {
      const valStr = row["a_系統佔比(同產業)"]?.replace('%', '') || "0";
      const val = parseFloat(valStr) || 0;
      if (val > 0) {
        systems[row.系統名稱] = Math.max(systems[row.系統名稱] || 0, val);
      }
    });
    // Return all systems sorted by value
    return Object.entries(systems)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [industryStats]);

  const top5Systems = useMemo(() => systemDistribution.slice(0, 5), [systemDistribution]);

  // Helper for metrics parsing
  const parseMetric = (val: string | undefined) => {
    if (!val) return 0;
    const num = parseFloat(val.toString().replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
  };

  const getMetrics = (row: DatabaseRow) => {
    const carbonReduction = parseMetric(row["c_碳減量中位數"]);
    const energyPotentialMWh = parseMetric(row["c_節能潛力中位數"]);
    const energyPotentialKWh = energyPotentialMWh * 1000;
    const cost = parseMetric(row["c_投資成本中位數"]);
    const saving = parseMetric(row["c_年節省成本中位數"]);
    const payback = parseMetric(row["c_回收年限中位數"]);
    const unitCost = parseMetric(row["c_單位減碳成本中位數"]);
    
    return { carbonReduction, energyPotentialKWh, cost, saving, payback, unitCost };
  };

  // Phase 1.5 & Phase 4: Smart Recommendation Logic
  const recommendations = useMemo(() => {
    if (industryStats.length === 0) return { type: 'none', items: [], targetGap: 0 };

    const getValue = (r: DatabaseRow, path: GoalPath) => {
        if (path === 'carbon') {
            return parseFloat(r["c_碳減量中位數"]) || 0;
        } else {
            return (parseFloat(r["c_節能潛力中位數"]) || 0) * 1000;
        }
    };
    
    const getSystemShare = (r: DatabaseRow) => {
        const valStr = r["a_系統佔比(同產業)"]?.replace('%', '') || "0";
        return parseFloat(valStr) || 0;
    };

    let targetGap = 0;
    let path: GoalPath = 'carbon';

    if (userGoal) {
        path = userGoal.path;
        const current = userGoal.currentValue;
        
        if (userGoal.targetType === 'percentage') {
             targetGap = current * (userGoal.targetValue / 100);
        } else {
             targetGap = userGoal.targetValue;
        }
    } else {
        path = 'carbon'; 
    }

    let validActions = industryStats
        .filter(r => r.措施類型 && r.措施類型 !== '0' && getValue(r, path) > 0);

    if (!userGoal) {
        // Phase 4 "No Goal": Sort by Share DESC then Impact
        validActions = validActions.sort((a, b) => {
            const shareA = getSystemShare(a);
            const shareB = getSystemShare(b);
            if (shareB !== shareA) return shareB - shareA;
            return getValue(b, path) - getValue(a, path);
        });
        
        return {
            type: 'no_goal',
            items: validActions.slice(0, 5),
            targetGap: 0
        };
    } else {
        // "Has Goal": Sort by Impact
        validActions = validActions.sort((a, b) => getValue(b, path) - getValue(a, path));
        
        const primaryAction = validActions[0];
        if (!primaryAction) return { type: 'none', items: [], targetGap };
        
        const primaryImpact = getValue(primaryAction, path);

        if (primaryImpact >= targetGap) {
            const alternatives = validActions
                .filter(r => r.措施類型 !== primaryAction.措施類型)
                .slice(0, 2);
            
            return { 
                type: 'single', 
                items: [primaryAction, ...alternatives], 
                targetGap 
            };
        } 
        else {
            const combo: DatabaseRow[] = [primaryAction];
            let currentSum = primaryImpact;
            
            const candidates = validActions.filter(r => r !== primaryAction);
            
            for (const cand of candidates) {
                if (currentSum >= targetGap) break;
                if (!combo.some(c => c.措施類型 === cand.措施類型)) {
                     combo.push(cand);
                     currentSum += getValue(cand, path);
                }
            }
            
            if (currentSum < targetGap) {
                 for (const cand of candidates) {
                    if (currentSum >= targetGap) break;
                    if (!combo.includes(cand)) {
                        combo.push(cand);
                        currentSum += getValue(cand, path);
                    }
                }
            }

            return { type: 'combo', items: combo, targetGap, totalImpact: currentSum };
        }
    }
  }, [industryStats, userGoal]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidIndustry && taxId.length === 8 && isPhoneValid) {
      setIsProfileComplete(true);
      setGoalMode('unset'); 
    }
  };

  const handleNoGoal = () => {
      setIsScanning(true);
      setTimeout(() => {
          setGoalMode('no_goal');
          setIsScanning(false);
      }, 1000);
  };

  // Helper for input formatting (thousands separator)
  const handleFormattedChange = (
    e: React.ChangeEvent<HTMLInputElement>, 
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    // Remove all non-numeric characters (integers only for simplicity and standard compliance)
    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
    
    if (!rawValue) {
      setter('');
      return;
    }

    // Format for display
    const formatted = Number(rawValue).toLocaleString('en-US');
    setter(formatted);
  };

  const handleConfirmGoal = () => {
    setIsScanning(true);
    setTimeout(() => {
      setUserGoal({
        path: goalPath,
        // Remove commas before parsing
        currentValue: parseFloat(currentVal.replace(/,/g, '')) || 0,
        targetType: targetMethod,
        targetValue: parseFloat(targetVal.replace(/,/g, '')) || 0
      });
      setGoalMode('has_goal');
      setIsScanning(false);
    }, 1200);
  };

  const resetAll = () => {
    setIsProfileComplete(false);
    setUserGoal(null);
    setGoalMode('unset');
    setIndustrySearch('');
    setTaxId('');
    setPhone('');
    setCurrentVal('');
    setTargetVal('');
    setTargetMethod('percentage'); // Reset to default
  };

  const handleRFQ = (action: DatabaseRow) => {
      const params = new URLSearchParams({
          source: 'netellus_ai',
          industry: industrySearch,
          taxId: taxId,
          action: action.措施名稱 || action.措施類型,
          system: action.系統名稱
      });
      window.location.href = `https://rfq.netellus.com/rfq/create?${params.toString()}`;
  };

  // Updated formatValue based on new rules
  // Rule 1: < 1000 show up to 2 decimals
  // Rule 2: >= 1000 show integer only with commas
  // Rule 3: Unit Cost always integer
  const formatValue = (val: number, forceInteger: boolean = false) => {
      if (val === 0 || isNaN(val)) return "0";
      
      // Unit Cost rule or Large Value rule
      if (forceInteger || Math.abs(val) >= 1000) {
          return Math.round(val).toLocaleString('en-US');
      }
      
      // Small Value rule
      return val.toLocaleString('en-US', { 
          minimumFractionDigits: 0,
          maximumFractionDigits: 2 
      });
  };
  
  const getUnit = () => {
      if (userGoal) return userGoal.path === 'carbon' ? 'tCO2e' : 'kWh';
      return 'tCO2e'; 
  };

  if (isDbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-12 netellus-card shadow-sm">
          <div className="w-12 h-12 border-4 border-[#064E3B] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-[#064E3B] font-bold tracking-widest uppercase animate-pulse">大數據資料庫同步中...</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#064E3B', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#ECFDF5'];

  return (
    <div className="min-h-screen relative font-sans text-slate-900 pb-20">
      <header className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${isScrolled ? 'py-3 bg-white border-b border-slate-200' : 'py-6 bg-transparent'}`}>
        <div className="container mx-auto px-6 max-w-5xl flex justify-between items-center">
          <div className="cursor-pointer flex items-center space-x-3" onClick={resetAll}>
            <div className="w-9 h-9 bg-[#064E3B] rounded-lg flex items-center justify-center text-white font-black text-lg">N</div>
            <span className="text-xl font-bold tracking-tight text-[#064E3B]">Netellus</span>
          </div>
          {isProfileComplete && (
            <div className="flex items-center gap-4">
               <div className="hidden md:block text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Industry</p>
                  <p className="font-bold text-slate-800 text-sm">{industrySearch}</p>
               </div>
               <button onClick={resetAll} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 max-w-5xl pt-32">
        {!isProfileComplete ? (
          <div className="max-w-md mx-auto netellus-card p-8 animate-in fade-in zoom-in duration-300">
             <div className="mb-8">
               <h2 className="text-2xl font-bold mb-2 text-[#064E3B]">Phase 1. 資料建立</h2>
               <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Corporate Data Collection</p>
             </div>

             <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="relative" ref={suggestionRef}>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">1. 產業類別 (Industry)</label>
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
                      className={`w-full bg-slate-50 border rounded-lg px-4 py-3 font-medium outline-none transition-all text-base ${isValidIndustry ? 'border-[#064E3B] text-[#064E3B] bg-emerald-50/10' : 'border-slate-200 focus:border-[#064E3B]'}`} 
                      placeholder="請輸入關鍵字搜尋..." 
                    />
                    {isValidIndustry && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#064E3B]">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </div>
                  
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-[120] left-0 right-0 mt-2 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                      {filteredSuggestions.map((ind, i) => (
                        <div 
                          key={i} 
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setIndustrySearch(ind); 
                            setShowSuggestions(false); 
                          }} 
                          className={`px-4 py-3 cursor-pointer text-sm font-medium transition-colors border-b border-slate-50 last:border-0 hover:bg-slate-50 ${industrySearch === ind ? 'bg-emerald-50 text-[#064E3B]' : 'text-slate-600'}`}
                        >
                          {ind}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">2. 聯絡手機 (Mobile)</label>
                  <input 
                    required 
                    type="tel" 
                    autoComplete="off"
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                    className={`w-full bg-slate-50 border rounded-lg px-4 py-3 font-medium outline-none transition-all text-base ${
                        phone && !isPhoneValid 
                        ? 'border-red-300 focus:border-red-500 bg-red-50' 
                        : 'border-slate-200 focus:border-[#064E3B]'
                    }`}
                    placeholder="09xxxxxxxx (限 10 碼)" 
                  />
                  {phone && !isPhoneValid && (
                      <p className="text-red-500 text-xs font-bold mt-1">請輸入正確的 10 位數手機號碼，並以 09 開頭。</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">3. 統一編號 (Tax ID)</label>
                  <input 
                    required 
                    type="text" 
                    maxLength={8} 
                    autoComplete="off"
                    value={taxId} 
                    onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-medium outline-none focus:border-[#064E3B] transition-all text-base" 
                    placeholder="8 位數統編" 
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={!isValidIndustry || taxId.length !== 8 || !isPhoneValid} 
                    className={`w-full py-4 rounded-lg font-bold transition-all text-base ${isValidIndustry && taxId.length === 8 && isPhoneValid ? 'bg-[#064E3B] text-white hover:bg-emerald-900' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {isValidIndustry && taxId.length === 8 && isPhoneValid ? '下一步：目標設定' : '請填寫完整資訊'}
                  </button>
                </div>
             </form>
          </div>
        ) : goalMode === 'unset' ? (
           <div className="max-w-md mx-auto netellus-card p-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h2 className="text-2xl font-bold mb-8 text-[#064E3B]">您是否有明確的年度減量目標？</h2>
               <div className="space-y-4">
                   <button 
                     onClick={() => setGoalMode('has_goal_input')}
                     className="w-full py-4 border-2 border-[#064E3B] bg-[#064E3B] text-white rounded-lg font-bold hover:bg-emerald-900 transition-all"
                   >
                       我有明確目標
                   </button>
                   <button 
                     onClick={handleNoGoal}
                     className="w-full py-4 border-2 border-slate-200 text-slate-600 rounded-lg font-bold hover:border-[#064E3B] hover:text-[#064E3B] transition-all"
                   >
                       我目前沒有目標，請提供建議
                   </button>
               </div>
           </div>
        ) : goalMode === 'has_goal_input' ? (
          <div className="max-w-xl mx-auto netellus-card p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold mb-6 text-[#064E3B]">Phase 1.5 目標設定</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button onClick={() => setGoalPath('carbon')} className={`py-3 rounded-lg font-bold text-sm border transition-all ${goalPath === 'carbon' ? 'bg-[#064E3B] border-[#064E3B] text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>碳排放減量 (Carbon)</button>
              <button onClick={() => setGoalPath('energy')} className={`py-3 rounded-lg font-bold text-sm border transition-all ${goalPath === 'energy' ? 'bg-[#064E3B] border-[#064E3B] text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>節電目標 (Energy)</button>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="text-left space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">現況基準 (Baseline)</label>
                <div className="relative">
                  <input 
                      type="text" 
                      inputMode="numeric"
                      value={currentVal} 
                      onChange={(e) => handleFormattedChange(e, setCurrentVal)} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-2xl font-bold text-center outline-none focus:border-[#064E3B] transition-all" 
                      placeholder="0" 
                  />
                  <span className="absolute right-0 bottom-[-20px] text-[10px] font-bold text-slate-400">{goalPath === 'carbon' ? 'tCO2e' : 'kWh'}</span>
                </div>
              </div>
              <div className="text-left space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">目標減量 (Target)</label>
                    <div className="flex bg-slate-100 rounded p-0.5">
                         {/* Swapped order: Percentage First */}
                        <button 
                            onClick={() => {
                                setTargetMethod('percentage');
                                setTargetVal(''); // Clear to avoid format confusion
                            }} 
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${targetMethod === 'percentage' ? 'bg-white shadow-sm text-[#064E3B]' : 'text-slate-400'}`}
                        >
                            %
                        </button>
                        <button 
                            onClick={() => {
                                setTargetMethod('absolute');
                                setTargetVal('');
                            }} 
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${targetMethod === 'absolute' ? 'bg-white shadow-sm text-[#064E3B]' : 'text-slate-400'}`}
                        >
                            數值
                        </button>
                    </div>
                </div>
                <div className="relative">
                  <input 
                      type={targetMethod === 'percentage' ? "number" : "text"}
                      inputMode={targetMethod === 'percentage' ? "decimal" : "numeric"}
                      value={targetVal} 
                      onChange={(e) => {
                          if (targetMethod === 'percentage') {
                              setTargetVal(e.target.value);
                          } else {
                              handleFormattedChange(e, setTargetVal);
                          }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-2xl font-bold text-center outline-none focus:border-[#064E3B] transition-all" 
                      placeholder="0" 
                   />
                  <span className="absolute right-0 bottom-[-20px] text-[10px] font-bold text-slate-400">{targetMethod === 'percentage' ? '%' : (goalPath === 'carbon' ? 'tCO2e' : 'kWh')}</span>
                </div>
              </div>
            </div>
            <button 
                onClick={handleConfirmGoal} 
                className="w-full bg-[#064E3B] text-white py-4 rounded-lg font-bold hover:bg-emerald-900 transition-all flex items-center justify-center gap-2"
            >
              {isScanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>AI 運算配對中...</span>
                  </>
              ) : '生成最佳減量路徑'}
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Phase 1.5 & 2 & 3: Dashboard */}
            <div className="grid md:grid-cols-3 gap-6">
               <div className="md:col-span-2 netellus-card p-8 flex flex-col justify-between relative overflow-hidden bg-white">
                  <div>
                    <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest mb-4 inline-block ${!userGoal ? 'bg-slate-100 text-slate-600' : recommendations.type === 'single' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>
                        {!userGoal ? '產業潛力熱點 (Top Potential)' : recommendations.type === 'single' ? '單一達標路徑 (Single Path)' : '組合式減碳策略 (Combo Strategy)'}
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">
                        {!userGoal 
                           ? `依據 ${industryStats.length} 筆同業數據，為您篩選最佳減碳機會`
                           : recommendations.type === 'single' 
                                ? `恭喜！現有成熟技術可協助您達成目標` 
                                : `目標宏大，建議採取複合式減量策略`}
                    </h2>
                    <p className="text-slate-500 text-sm mt-2">
                        {!userGoal 
                            ? "以下是貴產業中，減碳效益與投資回收年限最佳的系統項目 (Top 5)。"
                            : recommendations.type === 'single'
                                ? `AI 分析顯示，導入單一高效能方案即可覆蓋您的目標缺口。`
                                : `單一措施不足以滿足需求，已為您組合多重路徑以最大化效益。`}
                    </p>
                  </div>
                  
                  {userGoal && (
                      <div className="mt-8 flex items-end gap-12 border-t border-slate-100 pt-6">
                        <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target Gap (目標缺口)</p>
                        <p className="text-4xl font-black text-[#064E3B]">{formatValue(recommendations.targetGap)} <span className="text-sm text-slate-400 font-bold">{getUnit()}</span></p>
                        </div>
                        {recommendations.type === 'combo' && (
                            <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">組合預期效益</p>
                            <p className="text-xl font-bold text-slate-700">
                                {(recommendations as any).totalImpact > recommendations.targetGap ? '100% 覆蓋' : `覆蓋率 ${Math.round(((recommendations as any).totalImpact / recommendations.targetGap) * 100)}%`}
                            </p>
                            </div>
                        )}
                      </div>
                  )}
               </div>

               <div className="netellus-card p-6 flex flex-col items-center justify-between bg-white relative">
                  <div className="w-full text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Phase 2. 產業系統佔比分佈</p>
                    <div className="w-full h-40 relative mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                            data={systemDistribution} // Full data for Chart
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                            >
                            {systemDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                            ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: 'none' }}
                                itemStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '12px' }}
                            />
                        </PieChart>
                        </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {/* Hybrid Display: Top 5 List */}
                  <div className="w-full border-t border-slate-100 pt-4 space-y-2">
                    {top5Systems.map((item, index) => (
                        <div key={index} className="flex justify-between items-center text-xs">
                            <span className="font-medium text-slate-600 truncate mr-2 flex items-center">
                                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                {item.name}
                            </span>
                            <span className="font-bold text-[#064E3B] whitespace-nowrap">市場佔比: {item.value}%</span>
                        </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* Phase 4 & 5: Action List with RFQ */}
            <div className="netellus-card p-8 bg-white">
                <h3 className="text-lg font-bold mb-6 text-slate-900 flex items-center justify-between border-b border-slate-100 pb-4">
                    <span>Phase 4. 顧問推薦方案 (Median Analysis)</span>
                </h3>
                
                <div className="grid gap-3">
                    {recommendations.items.map((row, idx) => {
                        const m = getMetrics(row);
                        
                        return (
                            <div 
                                key={idx}
                                className="bg-white p-5 rounded-lg border border-slate-200 hover:border-[#064E3B] group transition-all cursor-pointer"
                                onClick={() => setSelectedAction(row)}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className={`w-10 h-10 rounded-md flex items-center justify-center font-bold text-sm shrink-0 ${idx === 0 ? 'bg-[#064E3B] text-white' : 'bg-slate-100 text-slate-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div className="mb-1">
                                                {/* Hierarchy Enhancement: System Name First (Large & Bold) */}
                                                <h4 className="font-bold text-[#064E3B] text-lg mb-1 leading-tight">{row.系統名稱}</h4>
                                                
                                                <div className="flex items-center gap-2">
                                                    {/* Measure Name (Smaller, Secondary) */}
                                                    <span className="font-medium text-slate-600 text-sm">
                                                        {row.措施名稱 || row.措施類型}
                                                    </span>
                                                    
                                                    {idx === 0 && <span className="bg-[#064E3B] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">建議首選</span>}
                                                    {m.payback > 0 && m.payback < 3 && <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm">🚀 高速回收</span>}
                                                </div>
                                            </div>
                                            
                                            {/* Phase 4: Problem Statement Summary */}
                                            <p className="text-xs text-slate-400 line-clamp-1 mt-2 border-t border-slate-50 pt-1">
                                                {row["企業問題"] ? `痛點：${row["企業問題"]}` : "針對既有設備效率衰退問題進行改善"}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between md:justify-end gap-6 pl-14 md:pl-0">
                                        <div className="text-right shrink-0">
                                            {/* Logic to show relevant metric based on Goal Path, but listing mainly the Reduction amount */}
                                            <p className="text-xl font-black text-[#064E3B]">
                                                {userGoal?.path === 'energy' ? formatValue(m.energyPotentialKWh) : formatValue(m.carbonReduction)}
                                                <span className="text-[10px] text-slate-400 font-bold ml-1">
                                                    {userGoal?.path === 'energy' ? 'kWh/yr' : 'tCO2e/yr'}
                                                </span>
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400">回收年限 {formatValue(m.payback)} 年</p>
                                        </div>
                                        
                                        {/* Phase 5: Conversion Button */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRFQ(row); }}
                                            className="bg-[#064E3B] text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-emerald-900 transition-colors whitespace-nowrap shadow-sm"
                                        >
                                            即刻尋找解決方案
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {recommendations.items.length === 0 && (
                        <div className="p-8 text-center text-slate-400 font-bold bg-slate-50 rounded-lg">尚無符合此產業與目標的詳細措施建議</div>
                    )}
                </div>
            </div>
            
            {/* Detail Modal (Flat Style) with 6 Key Metrics */}
            {selectedAction && (() => {
                const m = getMetrics(selectedAction);
                return (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm" onClick={() => setSelectedAction(null)}>
                    <div className="bg-white p-8 rounded-lg max-w-2xl w-full border border-slate-200 shadow-xl animate-in zoom-in duration-200 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 right-0 p-6">
                            <button onClick={() => setSelectedAction(null)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                        
                        {/* Hierarchy Enhancement: System Name Top (Bold & Large) */}
                        <div className="mb-6">
                             <div className="flex items-center gap-2 mb-2">
                                <span className="inline-block bg-slate-100 text-slate-600 font-bold text-xs px-2 py-1 rounded">{selectedAction.案例公司產業別}</span>
                             </div>
                             
                             <h3 className="text-3xl font-black text-[#064E3B] mb-2">{selectedAction.系統名稱}</h3>
                             
                             <div className="flex items-center gap-3 text-lg font-medium text-slate-600">
                                <span>{selectedAction.措施名稱 || selectedAction.措施類型}</span>
                                {m.payback > 0 && m.payback < 3 && <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap self-center">🚀 高速回收</span>}
                             </div>
                        </div>
                        
                        {/* 6 Key Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">碳減量 (Carbon)</p>
                                <p className="text-xl font-black text-slate-900">{formatValue(m.carbonReduction)} <span className="text-xs font-medium text-slate-400">公噸/年</span></p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">節能潛力 (Energy)</p>
                                <p className="text-xl font-black text-slate-900">{formatValue(m.energyPotentialKWh)} <span className="text-xs font-medium text-slate-400">度/年</span></p>
                            </div>
                             <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">企業投資成本</p>
                                <p className="text-xl font-black text-slate-900">{formatValue(m.cost)} <span className="text-xs font-medium text-slate-400">萬元</span></p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">年節省成本</p>
                                <p className="text-xl font-black text-slate-900">{formatValue(m.saving)} <span className="text-xs font-medium text-slate-400">萬元</span></p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">回收年限 (ROI)</p>
                                <p className="text-xl font-black text-slate-900">{formatValue(m.payback)} <span className="text-xs font-medium text-slate-400">年</span></p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">單位減碳成本</p>
                                <p className="text-xl font-black text-slate-900">{m.unitCost > 0 ? formatValue(m.unitCost, true) : '--'} <span className="text-xs font-medium text-slate-400">元/噸</span></p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8">
                             <div className="p-5 bg-white border border-l-4 border-l-[#064E3B] border-slate-200 rounded-r-lg shadow-sm">
                                 <h4 className="font-bold text-[#064E3B] text-sm mb-2 flex items-center gap-2">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                     企業問題 (Pain Points)
                                 </h4>
                                 <p className="text-sm text-slate-700 leading-relaxed">{selectedAction["企業問題"] || "既有設備能效低落，維護成本逐年上升，且無法滿足日益嚴格的法規要求。"}</p>
                             </div>
                             <div className="p-5 bg-white border border-l-4 border-l-blue-600 border-slate-200 rounded-r-lg shadow-sm">
                                 <h4 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                                    解決方案 (Solution)
                                 </h4>
                                 <p className="text-sm text-slate-700 leading-relaxed">{selectedAction["解決方案"] || `導入高效能${selectedAction.措施類型}，配合智慧控制系統，預期可顯著降低能耗並延長設備壽命。`}</p>
                             </div>
                        </div>

                        <button 
                            onClick={() => handleRFQ(selectedAction)}
                            className="w-full py-4 bg-[#064E3B] text-white rounded-lg font-bold hover:bg-emerald-900 transition-colors shadow-sm text-base flex items-center justify-center gap-2"
                        >
                            <span>前往 RFQ 平台詢價</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                        </button>
                    </div>
                </div>
                );
            })()}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;