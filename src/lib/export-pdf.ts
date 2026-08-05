export type PdfSection = { title: string; head: string[]; rows: (string | number)[][] };

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

/**
 * Печать/сохранение отчёта в PDF без внешних зависимостей — работает офлайн.
 * Открывает окно печати; в диалоге можно выбрать «Сохранить как PDF».
 */
export function printReportPdf(title: string, subtitle: string, sections: PdfSection[]) {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#111; margin:24px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { color:#666; font-size:12px; margin-bottom:18px; }
  h2 { font-size:14px; margin:18px 0 6px; padding-bottom:4px; border-bottom:1px solid #ddd; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th, td { border:1px solid #ddd; padding:5px 6px; text-align:left; vertical-align:top; }
  th { background:#f4f4f5; font-weight:600; }
  tr:nth-child(even) td { background:#fafafa; }
  @page { size: A4; margin: 12mm; }
</style></head><body>
<h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div>
${sections
  .map(
    (s) => `<h2>${esc(s.title)}</h2><table><thead><tr>${s.head
      .map((h) => `<th>${esc(h)}</th>`)
      .join("")}</tr></thead><tbody>${
      s.rows.length
        ? s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${s.head.length}">Нет данных</td></tr>`
    }</tbody></table>`,
  )
  .join("")}
<script>window.onload=function(){setTimeout(function(){window.print();},150);};<\/script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return false;
  }
  w.document.write(html);
  w.document.close();
  return true;
}
