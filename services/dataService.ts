import { DatabaseRow } from "../types.ts";

// 使用 Google Visualization API 導出 CSV
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1RH52lJntYqVS-WW9iVsqFxtN9uWJY7k4Noipt3Tn-qU/gviz/tq?tqx=out:csv&sheet=%E7%B5%90%E6%9E%9C%E7%B8%BD%E8%A1%A8";

export async function fetchDatabase(): Promise<DatabaseRow[]> {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error("無法連接到資料庫");
    const text = await response.text();
    
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
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
    // 移除引號並清理標頭
    const cleanHeaders = headers.map(h => h.replace(/^"|"$/g, ''));

    const rows = lines.slice(1)
      .filter(line => line.trim() !== "")
      .map(line => {
        const values = parseLine(line);
        const obj: any = {};
        cleanHeaders.forEach((header, i) => {
          // 清理數值中的引號
          const val = (values[i] || "").replace(/^"|"$/g, '');
          obj[header] = val;
        });
        // 不使用 'as DatabaseRow'，直接返回已定義型別的物件
        const row: DatabaseRow = obj;
        return row;
      });

    return rows;
  } catch (error) {
    console.error("Database fetch error:", error);
    return [];
  }
}