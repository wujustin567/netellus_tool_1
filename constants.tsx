
import { IndustryData } from './types';

export const INDUSTRIES: IndustryData[] = [
  {
    id: 'electronics',
    name: '電子零組件製造業',
    painPoints: [
      '空調系統老舊導致電力成本極高 (占總電費 40%+)',
      '無塵室能耗壓力隨製程精密度提升增加',
      '供應鏈碳足跡轉嫁壓力 (ESG 評鑑要求)',
      '缺乏具體的設備汰換成效數據供決策參考'
    ],
    focusAreas: [
      {
        name: '空調與冷卻系統',
        percentage: 60,
        description: '電子業的高精度生產環境需恆溫恆濕，空調系統是最大的能耗來源。',
        actions: [
          { id: 'ac-1', title: '磁懸浮離心式冰機汰換', reductionTons: 120, paybackYears: 2.8, adoptionRate: 65, cost: 550, savingPerYear: 196, description: '超高能效比方案' },
          { id: 'ac-2', title: '冷卻塔變頻優化控制', reductionTons: 45, paybackYears: 1.5, adoptionRate: 82, cost: 120, savingPerYear: 80, description: '低門檻快速回收' },
          { id: 'ac-3', title: '無塵室乾盤管系統改裝', reductionTons: 85, paybackYears: 3.2, adoptionRate: 40, cost: 380, savingPerYear: 118, description: '中大型工廠推薦' },
          { id: 'ac-4', title: '冰水主機群控系統 (AI)', reductionTons: 30, paybackYears: 1.2, adoptionRate: 55, cost: 65, savingPerYear: 54, description: '智慧化基礎設施' }
        ]
      },
      {
        name: '生產製程能效',
        percentage: 25,
        description: '包括空壓機系統與自動化生產線的電力優化。',
        actions: [
          { id: 'ep-1', title: '雙段壓縮高效空壓機', reductionTons: 55, paybackYears: 2.5, adoptionRate: 70, cost: 180, savingPerYear: 72, description: '製程基礎優化' },
          { id: 'ep-2', title: '烤箱排熱能源回收系統', reductionTons: 95, paybackYears: 3.8, adoptionRate: 35, cost: 420, savingPerYear: 110, description: '高熱能製程專用' },
          { id: 'ep-3', title: '伺服馬達自動化節能控制', reductionTons: 15, paybackYears: 2.1, adoptionRate: 60, cost: 45, savingPerYear: 21, description: '精密控制方案' }
        ]
      }
    ]
  },
  {
    id: 'textile',
    name: '紡織染整業',
    painPoints: ['染色製程高度耗能與熱流流失', '廢水處理能耗管理'],
    focusAreas: [
      {
        name: '熱能回收系統',
        percentage: 55,
        description: '染整廢熱水回收是主要節能手段。',
        actions: [
          { id: 'tx-1', title: '高溫廢水多段式熱交換', reductionTons: 110, paybackYears: 3.5, adoptionRate: 45, cost: 350, savingPerYear: 100, description: '核心減碳方案' },
          { id: 'tx-2', title: '染缸煙道氣廢熱回收', reductionTons: 40, paybackYears: 2.4, adoptionRate: 30, cost: 140, savingPerYear: 58, description: '氣體熱回收' },
          { id: 'tx-3', title: '智慧蒸氣排汗監測系統', reductionTons: 25, paybackYears: 1.8, adoptionRate: 50, cost: 85, savingPerYear: 47, description: '數位管理提升' }
        ]
      }
    ]
  }
];
