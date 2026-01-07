import { DatabaseRow } from "../types.ts";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1RH52lJntYqVS-WW9iVsqFxtN9uWJY7k4Noipt3Tn-qU/gviz/tq?tqx=out:csv&sheet=%E7%B5%90%E6%9E%9C%E7%B8%BD%E8%A1%A8";

export async function fetchDatabase(): Promise<DatabaseRow[]> {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error("Database link failed");
    const text = await response.text();
    
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
          obj[header] = values[i]?.replace(/^"|"$/g, '') || "";
        });
        return obj;
      });

    return rows;
  } catch (error) {
    console.error("Fetch error:", error);
    return [];
  }
}