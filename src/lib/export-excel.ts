import * as XLSX from "xlsx";

export type Sheet = { name: string; rows: (string | number)[][] };

export function downloadWorkbook(fileName: string, sheets: Sheet[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    const widths = (s.rows[0] ?? []).map((_, i) =>
      ({ wch: Math.min(38, Math.max(12, ...s.rows.map((r) => String(r[i] ?? "").length + 2))) }),
    );
    ws["!cols"] = widths;
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName);
}
