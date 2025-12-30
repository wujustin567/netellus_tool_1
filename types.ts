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

export interface IndustryAction {
  id: string;
  title: string;
  reductionTons: number;
  paybackYears: number;
  adoptionRate: number;
  cost: number;
  savingPerYear: number;
  description: string;
}

export interface FocusArea {
  name: string;
  percentage: number;
  description: string;
  actions: IndustryAction[];
}

export interface IndustryData {
  id: string;
  name: string;
  painPoints: string[];
  focusAreas: FocusArea[];
}