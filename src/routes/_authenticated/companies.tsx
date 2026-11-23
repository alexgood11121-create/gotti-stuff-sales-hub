import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Plus, Trash2, UserPlus, FileSpreadsheet, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-hooks";
import { formatUZS } from "@/lib/format";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/companies")({
  ssr: false,
  head: () => ({ meta: [{ title: "Компании — Gotti Stuff" }] }),
  component: CompaniesPage,
});

type Emp = { id: string; name: string; position: string | null; is_active: boolean };
type Company = { id: string; name: string; contact_name: string | null; phone: string | null; employee_limit: number; company_employees: Emp[] };
type SaleRow = { id: string; created_at: string; total: number; cash_amount: number; card_amount: number; company_employee_id: string | null; debt_paid: boolean; sale_items: { product_name: string; variant_size: string | null; qty: number; total: number }[] };

const db = supabase as any;

function monthNow() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function CompaniesPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [list, setList] = useState<Company[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState(""); const [contact, setContact] = useState(""); const [phone, setPhone] = useState("");
  const [empName, setEmpName] = useState(""); const [empPos, setEmpPos] = useState("");
  const [month, setMonth] = useState(monthNow());
  const [sales, setSales] = useState<SaleRow[]>([]);

  async function load() {
    const { data, error } = await db.from("companies").select("id,name,contact_name,phone,employee_limit,company_employees(id,name,position,is_active)").eq("is_active", true).order("name");
    if (error) { toast.error(error.message); return; }
    setList(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function loadSales() {
    if (!sel) return;
    const [y, m] = month.split("-").map(Number);
    const from = new Date(y, m - 1, 1).toISOString(); const to = new Date(y, m, 1).toISOString();
    const { data } = await db.from("sales").select("id,created_at,total,cash_amount,card_amount,company_employee_id,debt_paid,sale_items(product_name,variant_size,qty,total)")
      .eq("company_id", sel).gte("created_at", from).lt("created_at", to).neq("status", "cancelled").order("created_at", { ascending: false });
    setSales(data ?? []);
  }
  useEffect(() => { loadSales(); }, [sel, month]);

  const company = list.find((c) => c.id === sel);
  const comp = (s: SaleRow) => Math.max(0, Number(s.total) - Number(s.cash_amount ?? 0) - Number(s.card_amount ?? 0));
  async function saveLimit(v: number) {
    if (!sel || !(v >= 0)) return;
    const { error } = await db.from("companies").update({ employee_limit: v }).eq("id", sel);
    if (error) return toast.error(error.message);
    toast.success("Лимит сохранён"); load();
  }
  const empName_ = (id: string | null) => company?.company_employees.find((e) => e.id === id)?.name ?? "—";
  const byEmp = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) m.set(s.company_employee_id ?? "", (m.get(s.company_employee_id ?? "") ?? 0) + comp(s));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sales]);
  const overall = sales.reduce((a, s) => a + comp(s), 0);
  const unpaid = sales.filter((s) => !s.debt_paid).reduce((a, s) => a + comp(s), 0);

  async function addCompany() {
    if (!name.trim()) return;
    const { error } = await db.from("companies").insert({ name: name.trim(), contact_name: contact || null, phone: phone || null });
    if (error) return toast.error(error.message);
    setName(""); setContact(""); setPhone(""); load();
  }
  async function delCompany(id: string) {
    if (!confirm("Удалить компанию?")) return;
    await db.from("companies").update({ is_active: false }).eq("id", id); if (sel === id) setSel(null); load();
  }
  async function addEmp() {
    if (!sel || !empName.trim()) return;
    const { error } = await db.from("company_employees").insert({ company_id: sel, name: empName.trim(), position: empPos || null });
    if (error) return toast.error(error.message);
    setEmpName(""); setEmpPos(""); load();
  }
  async function delEmp(id: string) { await db.from("company_employees").update({ is_active: false }).eq("id", id); load(); }
  async function markPaid() {
    const ids = sales.filter((s) => !s.debt_paid).map((s) => s.id);
    if (!ids.length) return;
    const { error } = await db.from("sales").update({ debt_paid: true }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Отмечено как оплачено"); loadSales();
  }
  function exportXlsx() {
    const rows: any[] = sales.slice().reverse().map((s) => {
      const d = new Date(s.created_at);
      return {
        Дата: d.toLocaleDateString("ru-RU"),
        Время: d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        Сотрудник: empName_(s.company_employee_id),
        Товары: s.sale_items.map((i) => `${i.product_name}${i.variant_size ? ` (${i.variant_size})` : ""} ×${i.qty}`).join(", "),
        "Сумма чека": Number(s.total),
        "На компанию": comp(s),
      };
    });
    rows.push({});
    for (const [id, sum] of byEmp) rows.push({ Дата: "Итого сотрудник", Сотрудник: empName_(id), "На компанию": sum });
    rows.push({ Дата: "ИТОГО К ОПЛАТЕ", "На компанию": overall });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Отчёт");
    XLSX.writeFile(wb, `${company?.name ?? "company"}-${month}.xlsx`);
  }

  return (
    <div className="p-4 md:p-6 min-h-full overflow-x-hidden space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6" />Компании</h1>
      {isAdmin && (
        <Card className="p-4 grid gap-2 sm:grid-cols-4">
          <Input placeholder="Название компании" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Босс / контакт" value={contact} onChange={(e) => setContact(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button onClick={addCompany}><Plus className="w-4 h-4 mr-1" />Добавить</Button>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {list.length === 0 && <div className="text-muted-foreground text-sm">Компаний пока нет</div>}
          {list.map((c) => (
            <Card key={c.id} onClick={() => setSel(c.id)} className={`p-3 cursor-pointer flex justify-between items-center ${sel === c.id ? "border-primary" : ""}`}>
              <div><div className="font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.company_employees.filter((e) => e.is_active).length} сотр. {c.contact_name ? `· ${c.contact_name}` : ""}</div></div>
              {isAdmin && <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); delCompany(c.id); }}><Trash2 className="w-4 h-4" /></Button>}
            </Card>
          ))}
        </div>
        {company && (
          <div className="space-y-4">
            <Card className="p-4 space-y-2">
              <div className="font-semibold">Сотрудники</div>
              {isAdmin && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Лимит на человека (за чек):</span>
                  <Input key={company.id + company.employee_limit} type="number" defaultValue={company.employee_limit ?? 30000} className="w-32 h-9" onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(company.employee_limit)) saveLimit(v); }} />
                </div>
              )}
              {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input placeholder="Имя сотрудника" value={empName} onChange={(e) => setEmpName(e.target.value)} />
                  <Input placeholder="Должность" value={empPos} onChange={(e) => setEmpPos(e.target.value)} />
                  <Button onClick={addEmp}><UserPlus className="w-4 h-4 mr-1" />Добавить</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {company.company_employees.filter((e) => e.is_active).map((e) => (
                  <span key={e.id} className="px-3 py-1 rounded-full bg-muted text-sm flex items-center gap-1">
                    {e.name}{e.position ? ` · ${e.position}` : ""}
                    {isAdmin && <button onClick={() => delEmp(e.id)} className="text-destructive ml-1">×</button>}
                  </span>
                ))}
              </div>
            </Card>
            {isAdmin && (
              <Card className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
                  <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button>
                  <Button onClick={markPaid} disabled={unpaid <= 0}><Check className="w-4 h-4 mr-1" />Босс оплатил</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted rounded-lg p-3"><div className="text-xs text-muted-foreground">Оверал за месяц</div><div className="text-xl font-bold">{formatUZS(overall)}</div></div>
                  <div className="bg-muted rounded-lg p-3"><div className="text-xs text-muted-foreground">Не оплачено</div><div className="text-xl font-bold text-destructive">{formatUZS(unpaid)}</div></div>
                </div>
                <div>
                  <div className="font-semibold mb-1">По сотрудникам</div>
                  {byEmp.map(([id, sum]) => <div key={id} className="flex justify-between border-b border-border py-1 text-sm"><span>{empName_(id)}</span><span className="font-semibold">{formatUZS(sum)}</span></div>)}
                </div>
                <div className="space-y-2">
                  <div className="font-semibold">Покупки</div>
                  {sales.length === 0 && <div className="text-sm text-muted-foreground">Нет покупок за этот месяц</div>}
                  {sales.map((s) => (
                    <div key={s.id} className="border border-border rounded-lg p-2 text-sm">
                      <div className="flex justify-between"><span>{empName_(s.company_employee_id)} · {new Date(s.created_at).toLocaleString("ru-RU")}</span><span className="font-semibold">{formatUZS(comp(s))}{comp(s) < Number(s.total) ? ` (чек ${formatUZS(Number(s.total))})` : ""}{s.debt_paid ? " ✓" : ""}</span></div>
                      <div className="text-muted-foreground">{s.sale_items.map((i) => `${i.product_name}${i.variant_size ? ` (${i.variant_size})` : ""} ×${i.qty}`).join(", ")}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
