import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { fetchDatabase } from './services/dataService.ts';
import { DatabaseRow, UserGoal, GoalPath } from './types.ts';

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button 
      onClick={onClick}
      className="text-slate-400 hover:text-slate-600 font-bold text-sm flex items-center gap-1.5 px-3 py-2 -ml-3 rounded-lg hover:bg-slate-100/50 w-fit transition-colors relative z-10"
  >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
      <span>返回修改</span>
  </button>
);

const MainContainer = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 pb-20 pt-24 md:pt-6">
        <div className={`w-full max-w-4xl netellus-card p-8 md:p-12 relative overflow-hidden animate-in zoom-in fade-in duration-500 ${className}`}>
            {children}
        </div>
    </div>
);

const CurrentIndustryBadge = ({ industry }: { industry: string }) => (
    <div className="absolute top-8 right-8 hidden md:block">
        <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Industry Focus</p>
            <p className="font-bold text-slate-800 text-sm">{industry}</p>
        </div>
    </div>
);

const App: React.FC = () => {
  const [db, setDb] = useState<DatabaseRow[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  
  // Profile State
  const [industrySearch, setIndustrySearch] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phone, setPhone] = useState<string>('');
  const [taxId, setTaxId] = useState<string>('');
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Goal Setting State
  const [goalMode, setGoalMode] = useState<'unset' | 'has_goal' | 'no_goal' | 'has_goal_input'>('unset');
  const [userGoal, setUserGoal] = useState<UserGoal | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const [goalPath, setGoalPath] = useState<GoalPath>('carbon');
  const [targetMethod, setTargetMethod] = useState<'percentage' | 'absolute'>('percentage');
  
  const [currentVal, setCurrentVal] = useState<string>('');
  const [targetVal, setTargetVal] = useState<string>(''); 

  // UI State
  const [selectedAction, setSelectedAction] = useState<DatabaseRow | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

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

  // Phone Validation
  const isPhoneValid = useMemo(() => {
      return phone.startsWith('09') && phone.length === 10;
  }, [phone]);

  // Data Analysis
  const industryStats = useMemo(() => {
    if (!isValidIndustry) return [];
    return db.filter(r => r.案例公司產業別 === industrySearch);
  }, [db, industrySearch, isValidIndustry]);

  const systemDistribution = useMemo(() => {
    const systems: Record<string, number> = {};
    industryStats.forEach(row => {
      const valStr = row["a_系統佔比(同產業)"]?.replace('%', '') || "0";
      const val = parseFloat(valStr) || 0;
      if (val > 0) {
        systems[row.系統名稱] = Math.max(systems[row.系統名稱] || 0, val);
      }
    });
    return Object.entries(systems)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [industryStats]);

  const top5Systems = useMemo(() => systemDistribution.slice(0, 5), [systemDistribution]);

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

  const handleBackToProfile = () => {
    setIsProfileComplete(false);
  };

  const handleBackToGoalChoice = () => {
    setGoalMode('unset');
    setUserGoal(null);
  };

  const handleBackToGoalInput = () => {
      setGoalMode('has_goal_input');
  };

  const handleFormattedChange = (
    e: React.ChangeEvent<HTMLInputElement>, 
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
    if (!rawValue) {
      setter('');
      return;
    }
    const formatted = Number(rawValue).toLocaleString('en-US');
    setter(formatted);
  };

  const handleConfirmGoal = () => {
    setIsScanning(true);
    setTimeout(() => {
      setUserGoal({
        path: goalPath,
        currentValue: parseFloat(currentVal.replace(/,/g, '')) || 0,
        targetType: targetMethod,
        targetValue: parseFloat(targetVal.replace(/,/g, '')) || 0
      });
      setGoalMode('has_goal');
      setIsScanning(false);
    }, 1200);
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

  const formatValue = (val: number, forceInteger: boolean = false) => {
      if (val === 0 || isNaN(val)) return "0";
      if (forceInteger || Math.abs(val) >= 1000) {
          return Math.round(val).toLocaleString('en-US');
      }
      return val.toLocaleString('en-US', { 
          minimumFractionDigits: 0,
          maximumFractionDigits: 2 
      });
  };
  
  const getUnit = () => {
      if (userGoal) return userGoal.path === 'carbon' ? 'tCO2e' : 'kWh';
      return 'tCO2e'; 
  };

  const COLORS = ['#064E3B', '#059669', '#10B981', '#34D399', '#6EE7B7'];

  if (isDbLoading) {
    return (
      <MainContainer className="max-w-md text-center py-20">
          <div className="w-16 h-16 border-4 border-[#064E3B] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-[#064E3B] font-bold tracking-widest uppercase animate-pulse">Netellus 智庫同步中...</p>
      </MainContainer>
    );
  }

  if (db.length === 0) {
    return (
        <MainContainer className="max-w-md text-center py-10">
            <h3 className="text-xl font-bold text-red-600 mb-4">無法載入資料庫</h3>
            <p className="text-slate-600 mb-6">請檢查您的網路連線或稍後再試。</p>
            <button onClick={() => window.location.reload()} className="btn-cta px-6 py-3">重新整理</button>
        </MainContainer>
    );
  }

  // --- Views ---

  // 1. Profile View
  if (!isProfileComplete) {
      return (
          <MainContainer className="max-w-lg">
             <div className="text-center mb-10">
               <h2 className="text-3xl font-black mb-2 text-[#111827]">基礎資料收集</h2>
               <p className="text-slate-500 font-medium">Netellus 企業減碳決策支援系統</p>
             </div>

             <form onSubmit={handleProfileSubmit} className="space-y-8">
                <div className="relative" ref={suggestionRef}>
                  <label className="text-sm font-bold text-slate-500 mb-2 block text-center uppercase tracking-wider">產業類別 (Industry)</label>
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
                      className="w-full h-14 rounded-xl text-lg transition-all" 
                      placeholder="請輸入關鍵字搜尋..." 
                    />
                    {showSuggestions && filteredSuggestions.length > 0 && (
                        <div className="absolute z-[120] top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden max-h-60 overflow-y-auto text-left">
                        {filteredSuggestions.map((ind, i) => (
                            <div 
                            key={i} 
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIndustrySearch(ind); 
                                setShowSuggestions(false); 
                            }} 
                            className={`px-6 py-3 cursor-pointer text-sm font-bold transition-colors border-b border-slate-50 hover:bg-emerald-50 ${industrySearch === ind ? 'bg-emerald-50 text-[#064E3B]' : 'text-slate-600'}`}
                            >
                            {ind}
                            </div>
                        ))}
                        </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm font-bold text-slate-500 mb-2 block text-center uppercase tracking-wider">聯絡手機</label>
                        <input 
                            required 
                            type="tel" 
                            value={phone} 
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                            className={`w-full h-14 rounded-xl text-lg ${phone && !isPhoneValid ? 'border-red-300 bg-red-50' : ''}`}
                            placeholder="09xxxxxxxx" 
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-500 mb-2 block text-center uppercase tracking-wider">統一編號</label>
                        <input 
                            required 
                            type="text" 
                            maxLength={8} 
                            value={taxId} 
                            onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))} 
                            className="w-full h-14 rounded-xl text-lg" 
                            placeholder="8 位數統編" 
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={!isValidIndustry || taxId.length !== 8 || !isPhoneValid} 
                    className={`w-full py-4 btn-cta text-lg mt-4 ${!(isValidIndustry && taxId.length === 8 && isPhoneValid) ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-400' : ''}`}
                >
                    下一步：目標設定
                </button>
             </form>
          </MainContainer>
      );
  }

  // 2. Goal Selection View
  if (goalMode === 'unset') {
      return (
          <MainContainer className="max-w-xl text-center">
             <div className="absolute top-8 left-8">
                <BackButton onClick={handleBackToProfile} />
             </div>
             <CurrentIndustryBadge industry={industrySearch} />
             
             <h2 className="text-3xl font-black mb-8 mt-4 text-[#111827]">您是否有明確的年度減量目標？</h2>
             <div className="space-y-4">
                <button 
                    onClick={() => setGoalMode('has_goal_input')}
                    className="w-full py-5 btn-cta text-lg"
                >
                    我有明確目標
                </button>
                <button 
                    onClick={handleNoGoal}
                    className="w-full py-5 bg-white border-2 border-slate-200 text-slate-500 font-bold rounded-2xl hover:border-slate-300 hover:text-slate-700 transition-all"
                >
                    我目前沒有目標，請提供建議
                </button>
             </div>
          </MainContainer>
      );
  }

  // 3. Goal Input View
  if (goalMode === 'has_goal_input') {
      return (
          <MainContainer className="max-w-xl">
            <div className="absolute top-8 left-8">
                <BackButton onClick={handleBackToGoalChoice} />
            </div>
            <CurrentIndustryBadge industry={industrySearch} />
            
            <div className="text-center mb-10 mt-2">
                <h2 className="text-3xl font-black text-[#111827]">設定減碳目標</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button onClick={() => setGoalPath('carbon')} className={`py-4 rounded-xl font-bold transition-all ${goalPath === 'carbon' ? 'bg-[#064E3B] text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>碳排放減量</button>
              <button onClick={() => setGoalPath('energy')} className={`py-4 rounded-xl font-bold transition-all ${goalPath === 'energy' ? 'bg-[#064E3B] text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>節電目標</button>
            </div>
            
            <div className="space-y-8 mb-10">
              <div>
                <label className="text-sm font-bold text-slate-500 mb-2 block text-center uppercase tracking-wider">現況基準 (Baseline)</label>
                <div className="relative">
                  <input 
                      type="text" 
                      inputMode="numeric"
                      value={currentVal} 
                      onChange={(e) => handleFormattedChange(e, setCurrentVal)} 
                      className="w-full h-16 text-3xl" 
                      placeholder="0" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{goalPath === 'carbon' ? 'tCO2e' : 'kWh'}</span>
                </div>
              </div>
              
              <div>
                <div className="flex justify-center items-center gap-4 mb-2">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">目標減量 (Target)</label>
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button 
                            onClick={() => { setTargetMethod('percentage'); setTargetVal(''); }} 
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${targetMethod === 'percentage' ? 'bg-white shadow-sm text-[#064E3B]' : 'text-slate-400'}`}
                        >
                            %
                        </button>
                        <button 
                            onClick={() => { setTargetMethod('absolute'); setTargetVal(''); }} 
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${targetMethod === 'absolute' ? 'bg-white shadow-sm text-[#064E3B]' : 'text-slate-400'}`}
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
                          if (targetMethod === 'percentage') setTargetVal(e.target.value);
                          else handleFormattedChange(e, setTargetVal);
                      }}
                      className="w-full h-16 text-3xl" 
                      placeholder="0" 
                   />
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{targetMethod === 'percentage' ? '%' : (goalPath === 'carbon' ? 'tCO2e' : 'kWh')}</span>
                </div>
              </div>
            </div>

            <button 
                onClick={handleConfirmGoal} 
                className="w-full py-5 btn-cta text-lg flex items-center justify-center gap-2"
            >
              {isScanning ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span>AI 運算配對中...</span>
                  </>
              ) : '生成最佳減量路徑'}
            </button>
          </MainContainer>
      );
  }

  // 4. Dashboard View
  return (
    <div className="min-h-screen pb-20 pt-24 md:pt-12 px-4 flex justify-center">
      <div className="w-full max-w-6xl space-y-6">
        {/* Main Dashboard Card */}
        <div className="netellus-card p-8 md:p-12 animate-in slide-in-up duration-700">
            <div className="flex justify-between items-start mb-6">
                <BackButton onClick={userGoal ? handleBackToGoalInput : handleBackToGoalChoice} />
                <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Industry Focus</p>
                    <p className="font-bold text-slate-800">{industrySearch}</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4 inline-block ${!userGoal ? 'bg-slate-100 text-slate-600' : 'bg-[#064E3B] text-white'}`}>
                        {!userGoal ? 'TOP POTENTIAL' : recommendations.type === 'single' ? 'SINGLE PATH' : 'COMBO STRATEGY'}
                    </span>
                    <h2 className="text-3xl md:text-4xl font-black text-[#111827] mb-4 leading-tight">
                        {!userGoal 
                           ? `依據 ${industryStats.length} 筆同業數據，為您篩選最佳減碳機會`
                           : recommendations.type === 'single' 
                                ? `恭喜！現有成熟技術可協助您達成目標` 
                                : `目標宏大，建議採取複合式減量策略`}
                    </h2>
                    
                    {userGoal && (
                        <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-end gap-8">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Target Gap (目標缺口)</p>
                                <p className="text-5xl font-black text-[#064E3B]">{formatValue(recommendations.targetGap)} <span className="text-lg text-slate-400 font-bold">{getUnit()}</span></p>
                            </div>
                            {recommendations.type === 'combo' && (
                                <div className="pb-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">策略覆蓋率</p>
                                    <p className="text-2xl font-bold text-slate-800">
                                        {(recommendations as any).totalImpact > recommendations.targetGap ? '100%' : `${Math.round(((recommendations as any).totalImpact / recommendations.targetGap) * 100)}%`}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 flex flex-col items-center justify-center relative">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 absolute top-6 left-6">市場熱點</p>
                    <div className="w-full h-40 relative mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                            data={systemDistribution}
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
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                        </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-full mt-4 space-y-2">
                         {top5Systems.slice(0,3).map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-xs px-2">
                                <span className="font-bold text-slate-600 flex items-center">
                                    <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                    {item.name}
                                </span>
                                <span className="font-bold text-[#064E3B]">{item.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* List Actions */}
            <div className="mt-12">
                <h3 className="text-xl font-bold mb-6 text-[#111827] border-b border-slate-100 pb-4">
                    同業執行成效參考 (Median Analysis)
                </h3>
                <div className="grid gap-4">
                    {recommendations.items.map((row, idx) => {
                         const m = getMetrics(row);
                         return (
                            <div 
                                key={idx}
                                className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-[#34FF5B] hover:shadow-lg transition-all cursor-pointer group"
                                onClick={() => setSelectedAction(row)}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                     <div className="flex items-center gap-6">
                                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${idx === 0 ? 'bg-[#34FF5B] text-slate-900' : 'bg-slate-100 text-slate-400'}`}>
                                            {idx + 1}
                                         </div>
                                         <div>
                                            <h4 className="font-bold text-[#064E3B] text-xl mb-1">{row.系統名稱}</h4>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-500 text-sm">{row.措施名稱 || row.措施類型}</span>
                                                {m.payback > 0 && m.payback < 3 && <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ROI &lt; 3年</span>}
                                            </div>
                                         </div>
                                     </div>

                                     <div className="flex items-center justify-between md:justify-end gap-8 pl-18 md:pl-0">
                                         <div className="text-right">
                                             <p className="text-2xl font-black text-[#111827]">
                                                {userGoal?.path === 'energy' ? formatValue(m.energyPotentialKWh) : formatValue(m.carbonReduction)}
                                                <span className="text-xs text-slate-400 font-bold ml-1">{userGoal?.path === 'energy' ? 'kWh' : 'tCO2e'}</span>
                                             </p>
                                             <p className="text-xs font-bold text-slate-400">回收年限 {formatValue(m.payback)} 年</p>
                                         </div>
                                         <button className="btn-cta px-6 py-3 text-sm hidden md:block">
                                             查看詳情
                                         </button>
                                     </div>
                                </div>
                            </div>
                         );
                    })}
                </div>
            </div>

            {/* Data Sourcing Disclosure */}
            <div className="mt-8 flex items-start gap-3 text-xs text-slate-500 bg-slate-50 p-5 rounded-2xl">
                <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p className="leading-relaxed"><strong>💡 數據依據說明：</strong>本系統所提供之行動建議與量化分析，係基於 Netellus 智庫收集之近 15,000 筆來自經濟部及相關部會之公開資料庫數據 進行交叉比對與運算得出。</p>
            </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-4">
            <div className="inline-flex items-center gap-4 text-xs font-medium text-white/80 bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
                <span>&copy; 2026 Netellus. All Rights Reserved.</span>
                <span className="w-px h-3 bg-white/30"></span>
                <button onClick={() => setShowPrivacy(true)} className="hover:text-[#34FF5B] underline decoration-transparent hover:decoration-[#34FF5B] transition-all">隱私權政策</button>
            </div>
        </footer>

        {/* Action Detail Modal */}
        {selectedAction && (() => {
            const m = getMetrics(selectedAction);
            return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedAction(null)}>
                <div className="bg-white rounded-[32px] max-w-3xl w-full p-8 md:p-10 animate-in zoom-in duration-200 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                     <button onClick={() => setSelectedAction(null)} className="absolute top-8 right-8 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    
                    <div className="mb-8">
                         <span className="bg-slate-100 text-slate-600 font-bold text-xs px-2 py-1 rounded mb-3 inline-block">{selectedAction.案例公司產業別}</span>
                         <h3 className="text-3xl font-black text-[#064E3B] mb-2">{selectedAction.系統名稱}</h3>
                         <p className="text-lg font-bold text-slate-500">{selectedAction.措施名稱 || selectedAction.措施類型}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                        <div className="p-4 bg-slate-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">減碳效益</p>
                            <p className="text-2xl font-black text-[#111827]">{formatValue(m.carbonReduction)} <span className="text-xs font-medium text-slate-400">tCO2e</span></p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">節能潛力</p>
                            <p className="text-2xl font-black text-[#111827]">{formatValue(m.energyPotentialKWh)} <span className="text-xs font-medium text-slate-400">kWh</span></p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">回收年限</p>
                            <p className="text-2xl font-black text-[#111827]">{formatValue(m.payback)} <span className="text-xs font-medium text-slate-400">年</span></p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">投資成本</p>
                            <p className="text-2xl font-black text-[#111827]">{formatValue(m.cost)} <span className="text-xs font-medium text-slate-400">萬</span></p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">年節省</p>
                            <p className="text-2xl font-black text-[#111827]">{formatValue(m.saving)} <span className="text-xs font-medium text-slate-400">萬</span></p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">單位成本</p>
                            <p className="text-2xl font-black text-[#111827]">{m.unitCost > 0 ? formatValue(m.unitCost, true) : '--'} <span className="text-xs font-medium text-slate-400">元/噸</span></p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                         <div className="p-6 bg-slate-50 rounded-2xl">
                             <h4 className="font-bold text-[#064E3B] text-sm mb-2">企業痛點 (Pain Points)</h4>
                             <p className="text-sm text-slate-700 leading-relaxed">{selectedAction["企業問題"] || "既有設備能效低落，維護成本逐年上升，且無法滿足日益嚴格的法規要求。"}</p>
                         </div>
                         <div className="p-6 bg-blue-50 rounded-2xl">
                             <h4 className="font-bold text-blue-800 text-sm mb-2">解決方案 (Solution)</h4>
                             <p className="text-sm text-slate-700 leading-relaxed">{selectedAction["解決方案"] || `導入高效能${selectedAction.措施類型}，配合智慧控制系統，預期可顯著降低能耗並延長設備壽命。`}</p>
                         </div>
                    </div>

                    <button 
                        onClick={() => handleRFQ(selectedAction)}
                        className="w-full py-5 btn-cta text-lg flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                    >
                        <span>即刻尋找解決方案</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                    </button>
                </div>
            </div>
            );
        })()}

        {/* Privacy Policy Modal */}
        {showPrivacy && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrivacy(false)}>
                <div className="bg-white rounded-[32px] p-8 md:p-10 max-w-2xl w-full animate-in zoom-in duration-200 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <h2 className="text-2xl font-black text-[#111827]">隱私權政策</h2>
                        <button onClick={() => setShowPrivacy(false)} className="text-slate-400 hover:text-slate-600 p-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <div className="space-y-4 text-sm text-slate-600 leading-relaxed overflow-y-auto pr-2">
                        <p className="font-bold">Netellus 企業減碳決策支援工具 隱私權政策</p>
                        <p>Netellus（零域科技有限公司，以下簡稱「本公司」）為尊重並保護您的個人資料與隱私權，特依據中華民國《個人資料保護法》及相關法令規定，制訂本隱私權政策，以說明本公司如何蒐集、處理、利用及保護您的個人資料。</p>
                        
                        <h4 className="font-bold text-[#111827] mt-4">一、個人資料之蒐集目的與類別</h4>
                        <p>1. 蒐集目的：本服務蒐集您的資料主要用於提供企業減碳決策分析、供應商媒合、系統優化及相關客戶服務。</p>
                        <p>2. 蒐集類別：包括但不限於產業類別、聯絡人手機號碼、公司統一編號、減碳目標設定數據等。</p>

                        <h4 className="font-bold text-[#111827] mt-4">二、個人資料之利用期間、地區、對象及方式</h4>
                        <p>1. 期間：自您使用本服務之日起，至您要求停止使用或本公司終止服務之日止。</p>
                        <p>2. 地區：中華民國境內及本公司伺服器所在地。</p>
                        <p>3. 對象：本公司、本公司之合作夥伴（如供應商媒合對象）及依法有權機關。</p>
                        <p>4. 方式：以自動化機器或其他非自動化之利用方式。</p>

                        <h4 className="font-bold text-[#111827] mt-4">三、資料安全保護</h4>
                        <p>本公司將採取合理之技術與管理措施，保障您的個人資料安全，防止未經授權之存取、洩漏或竄改。</p>

                        <h4 className="font-bold text-[#111827] mt-4">四、當事人權利</h4>
                        <p>您可依個資法規定，向本公司行使查詢、閱覽、製給複製本、補充或更正、停止蒐集/處理/利用或刪除您的個人資料之權利。</p>
                        
                        <div className="bg-slate-50 p-4 rounded-xl mt-6">
                        <p className="font-bold text-[#111827]">聯絡方式</p>
                        <p>若您對本隱私權政策有任何疑問，請透過以下方式聯繫：</p>
                        <ul className="list-none mt-2 space-y-1">
                            <li>📧 電子郵件：justin@netellus.com</li>
                            <li>📞 聯絡電話：0912268567</li>
                        </ul>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;