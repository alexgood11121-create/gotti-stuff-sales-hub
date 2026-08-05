import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listShifts, getShiftDetails } from "@/lib/shifts.functions";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatUZS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, Banknote, CreditCard, ArrowRight, X, Download, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { downloadWorkbook } from "@/lib/export-excel";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: AdminDashboard,
});

type PayFilter = "all" | "cash" | "card" | "mixed";

const PERIODS = [
  { key: "today", label: "Сегодня", days: 0 },
  { key: "7", label: "7 дней", days: 7 },
  { key: "30", label: "30 дней", days: 30 },
] as const;

function periodStart(key: string) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (key === "7") d.setDate(d.getDate() - 6);
  if (key === "30") d.setDate(d.getDate() - 29);
  return d;
}

function payLabel(m: string) {
  return m === "cash" ? "Наличные" : m === "card" ? "Карта" : "Смешанная";
}

function AdminDashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("today");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");

  const shiftsQ = useQuery({
    queryKey: ["admin-shifts-list"],
    queryFn: () => listShifts({ data: { limit: 100 } }),
    refetchInterval: 30000,
  });

  const detailsQ = useQuery({
    queryKey: ["admin-shift-details", selected],
    queryFn: () => getShiftDetails({ data: { id: selected! } }),
    enabled: !!selected,
  });

  // Все продажи за период — для кассы и разбивки нал/карта
  const salesQ = useQuery({
    queryKey: ["admin-sales", period],
    refetchInterval: 30000,
    queryFn: async () => {
      const from = periodStart(period).toISOString();
      const { data, error } = await supabase
        .from("sales")
        .select("id, created_at, total, cash_amount, card_amount, payment_method, cashier_id, branch_id, branches(name), sale_items(product_name, variant_size, qty, unit_price, total)")
        .gte("created_at", from)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const ids = Array.from(new Set((data ?? []).map((s: any) => s.cashier_id).filter(Boolean)));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nickname, email").in("id", ids);
        names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.nickname ?? p.email ?? "—"]));
      }
      return (data ?? []).map((s: any) => ({ ...s, cashier_name: names[s.cashier_id] ?? "—" }));
    },
  });

  const shifts = shiftsQ.data ?? [];
  const activeShift = useMemo(
    () => (shiftFilter === "all" ? null : (shifts as any[]).find((s) => s.id === shiftFilter) ?? null),
    [shiftFilter, shifts],
  );

  const sales = useMemo(() => {
    const all = salesQ.data ?? [];
    if (!activeShift) return all;
    const start = new Date(activeShift.started_at).getTime();
    const end = activeShift.ended_at ? new Date(activeShift.ended_at).getTime() : Date.now();
    return all.filter((s: any) => {
      const t = new Date(s.created_at).getTime();
      return s.cashier_id === activeShift.cashier_id && t >= start && t <= end;
    });
  }, [salesQ.data, activeShift]);

  const sums = useMemo(() => {
    return sales.reduce(
      (acc: any, s: any) => {
        acc.total += Number(s.total ?? 0);
        acc.cash += Number(s.cash_amount ?? 0);
        acc.card += Number(s.card_amount ?? 0);
        acc[s.payment_method] = (acc[s.payment_method] ?? 0) + 1;
        return acc;
      },
      { total: 0, cash: 0, card: 0, cash_n: 0, card_n: 0 },
    );
  }, [sales]);

  const filteredSales = useMemo(
    () => (payFilter === "all" ? sales : sales.filter((s: any) => s.payment_method === payFilter)),
    [sales, payFilter],
  );

  const openNow = useMemo(() => (shifts as any[]).filter((s) => !s.ended_at), [shifts]);
  const closedShifts = useMemo(() => (shifts as any[]).filter((s) => s.ended_at), [shifts]);
  const shiftLabel = (s: any) =>
    `${s.cashier?.nickname ?? s.cashier?.email ?? "—"} · ${new Date(s.started_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${s.ended_at ? "" : " (открыта)"}`;

  function exportPdf() {
    const label = PERIODS.find((p) => p.key === period)?.label ?? period;
    printReportPdf(
      "Gotti Stuff — отчёт по кассе",
      `${activeShift ? `Смена: ${shiftLabel(activeShift)}` : `Период: ${label}`} · Сформирован ${new Date().toLocaleString("ru-RU")}`,
      [
        {
          title: "Итоги",
          head: ["Показатель", "Значение"],
          rows: [
            ["Выручка всего", formatUZS(sums.total)],
            ["Наличными", formatUZS(sums.cash)],
            ["Картой", formatUZS(sums.card)],
            ["Чеков", sales.length],
          ],
        },
        {
          title: "По кассирам",
          head: ["Кассир", "Чеков", "Наличные", "Карта", "Итого"],
          rows: Array.from(
            sales
              .reduce((m: Map<string, any>, s: any) => {
                const cur = m.get(s.cashier_name) ?? { cash: 0, card: 0, total: 0, count: 0 };
                cur.cash += Number(s.cash_amount ?? 0);
                cur.card += Number(s.card_amount ?? 0);
                cur.total += Number(s.total ?? 0);
                cur.count += 1;
                return m.set(s.cashier_name, cur);
              }, new Map())
              .entries(),
          ).map(([n, v]: any) => [n, v.count, formatUZS(v.cash), formatUZS(v.card), formatUZS(v.total)]),
        },
        {
          title: `Продажи (${sales.length})`,
          head: ["Дата", "Кассир", "Филиал", "Оплата", "Итого", "Товары"],
          rows: sales.map((s: any) => [
            new Date(s.created_at).toLocaleString("ru-RU"),
            s.cashier_name,
            s.branches?.name ?? "—",
            payLabel(s.payment_method),
            formatUZS(s.total),
            (s.sale_items ?? [])
              .map((i: any) => `${i.product_name}${i.variant_size ? ` (${i.variant_size})` : ""} x${i.qty}`)
              .join(", "),
          ]),
        },
      ],
    );
    toast.success("Отчёт открыт — сохраните как PDF");
  }


  function exportExcel() {
    if (!sales.length) {
      toast.error("Нет продаж за выбранный период");
      return;
    }
    const label = PERIODS.find((p) => p.key === period)?.label ?? period;
    const salesRows: (string | number)[][] = [
      ["Дата", "Время", "Кассир", "Филиал", "Способ оплаты", "Наличные", "Карта", "Итого", "Товары"],
      ...sales.map((s: any) => {
        const d = new Date(s.created_at);
        return [
          d.toLocaleDateString("ru-RU"),
          d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          s.cashier_name,
          s.branches?.name ?? "—",
          payLabel(s.payment_method),
          Number(s.cash_amount ?? 0),
          Number(s.card_amount ?? 0),
          Number(s.total ?? 0),
          (s.sale_items ?? [])
            .map((i: any) => `${i.product_name}${i.variant_size ? ` (${i.variant_size})` : ""} x${i.qty}`)
            .join(", "),
        ];
      }),
    ];

    const byCashier = new Map<string, { cash: number; card: number; total: number; count: number }>();
    for (const s of sales as any[]) {
      const cur = byCashier.get(s.cashier_name) ?? { cash: 0, card: 0, total: 0, count: 0 };
      cur.cash += Number(s.cash_amount ?? 0);
      cur.card += Number(s.card_amount ?? 0);
      cur.total += Number(s.total ?? 0);
      cur.count += 1;
      byCashier.set(s.cashier_name, cur);
    }

    downloadWorkbook(`gotti-stuff-kassa-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        name: "Касса",
        rows: [
          ["Период", label],
          ["Сформирован", new Date().toLocaleString("ru-RU")],
          [],
          ["Показатель", "Сумма"],
          ["Выручка всего", sums.total],
          ["Наличными", sums.cash],
          ["Картой", sums.card],
          ["Чеков", sales.length],
        ],
      },
      {
        name: "По кассирам",
        rows: [
          ["Кассир", "Чеков", "Наличные", "Карта", "Итого"],
          ...Array.from(byCashier.entries()).map(([n, v]) => [n, v.count, v.cash, v.card, v.total]),
        ],
      },
      { name: "Продажи", rows: salesRows },
      {
        name: "Смены",
        rows: [
          ["Кассир", "Филиал", "Открытие", "Закрытие", "Выручка", "Наличные", "Карта", "Чеков", "Расхождение"],
          ...shifts.map((s: any) => [
            s.cashier?.nickname ?? s.cashier?.email ?? "—",
            s.branch?.name ?? "—",
            new Date(s.started_at).toLocaleString("ru-RU"),
            s.ended_at ? new Date(s.ended_at).toLocaleString("ru-RU") : "открыта",
            Number(s.stats?.total ?? 0),
            Number(s.stats?.cash ?? 0),
            Number(s.stats?.card ?? 0),
            Number(s.stats?.count ?? 0),
            s.cash_diff != null ? Number(s.cash_diff) : "",
          ]),
        ],
      },
    ]);
    toast.success("Excel-файл скачан");
  }

  return (
    <AppShell>
      <div className="p-6 h-screen overflow-y-auto space-y-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Дашборд</h1>
            <p className="text-sm text-muted-foreground">Касса, смены и продажи</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button onClick={exportPdf} variant="outline" className="shrink-0">
              <FileText className="w-4 h-4 mr-2" />PDF
            </Button>
            <Button onClick={exportExcel} className="shrink-0">
              <Download className="w-4 h-4 mr-2" />Excel
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? "default" : "outline"}
              onClick={() => setPeriod(p.key)}
              disabled={shiftFilter !== "all"}
            >
              {p.label}
            </Button>
          ))}
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm max-w-[320px]"
          >
            <option value="all">Все смены</option>
            {(shifts as any[]).map((s) => (
              <option key={s.id} value={s.id}>{shiftLabel(s)}</option>
            ))}
          </select>
          {shiftFilter !== "all" && (
            <Button size="sm" variant="ghost" onClick={() => setShiftFilter("all")}>
              <X className="w-3 h-3 mr-1" />Сбросить смену
            </Button>
          )}
          {activeShift && (
            <Button size="sm" variant="outline" onClick={() => setSelected(activeShift.id)}>
              Детали смены
            </Button>
          )}
        </div>


        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi title="Открытых смен" value={String(openNow.length)} icon={<Clock className="w-5 h-5" />} />
          <Kpi
            title="Выручка за период"
            value={formatUZS(sums.total)}
            icon={<TrendingUp className="w-5 h-5" />}
            active={payFilter === "all"}
            onClick={() => setPayFilter("all")}
          />
          <Kpi
            title="Наличные"
            value={formatUZS(sums.cash)}
            icon={<Banknote className="w-5 h-5" />}
            active={payFilter === "cash"}
            onClick={() => setPayFilter("cash")}
          />
          <Kpi
            title="Карта"
            value={formatUZS(sums.card)}
            icon={<CreditCard className="w-5 h-5" />}
            active={payFilter === "card"}
            onClick={() => setPayFilter("card")}
          />
        </div>

        <section>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-lg font-semibold mr-2 flex items-center gap-2">
              <Wallet className="w-4 h-4" />Касса
            </h2>
            {(["all", "cash", "card", "mixed"] as PayFilter[]).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={payFilter === f ? "default" : "outline"}
                onClick={() => setPayFilter(f)}
              >
                {f === "all" ? "Все" : payLabel(f)}
              </Button>
            ))}
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredSales.length} чек. ·{" "}
              {formatUZS(filteredSales.reduce((s: number, x: any) => s + Number(x.total ?? 0), 0))}
            </span>
          </div>
          {salesQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Загрузка...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-sm text-muted-foreground">Продаж нет</div>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border max-h-[420px] overflow-y-auto">
              {filteredSales.map((s: any) => (
                <div key={s.id} className="p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {s.cashier_name}
                      <span className="text-muted-foreground font-normal">
                        {" · "}{new Date(s.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.branches?.name ?? "—"} · {payLabel(s.payment_method)}
                      {s.payment_method === "mixed" && (
                        <> · нал {formatUZS(s.cash_amount)} + карта {formatUZS(s.card_amount)}</>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full shrink-0",
                      s.payment_method === "cash"
                        ? "bg-primary/20 text-primary"
                        : s.payment_method === "card"
                          ? "bg-blue-500/20 text-blue-500"
                          : "bg-yellow-500/20 text-yellow-600",
                    )}
                  >
                    {payLabel(s.payment_method)}
                  </span>
                  <div className="font-bold shrink-0">{formatUZS(s.total)}</div>
                </div>
              ))}
            </div>
          )}
        </section>


        {openNow.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-2">Открыты сейчас</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {openNow.map((s: any) => (
                <ShiftCard key={s.id} s={s} onOpen={() => setSelected(s.id)} live />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-2">История смен</h2>
          {shiftsQ.isLoading ? (
            <div className="text-muted-foreground text-sm">Загрузка...</div>
          ) : shifts.length === 0 ? (
            <div className="text-muted-foreground text-sm">Смен нет</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {shifts.filter((s: any) => s.ended_at).map((s: any) => (
                <ShiftCard key={s.id} s={s} onOpen={() => setSelected(s.id)} />
              ))}
            </div>
          )}
        </section>

        <div className="pt-2">
          <Link to="/admin/shifts"><Button variant="outline">Управление сменами и графиком</Button></Link>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">Смена</h3>
                {detailsQ.data && (
                  <p className="text-sm text-muted-foreground">
                    {detailsQ.data.cashier?.nickname ?? detailsQ.data.cashier?.email ?? "—"}
                    {detailsQ.data.branch && <> · {detailsQ.data.branch.name}</>}
                  </p>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
            </div>
            {!detailsQ.data ? (
              <div className="text-sm text-muted-foreground">Загрузка...</div>
            ) : (
              <ShiftDetail data={detailsQ.data} />
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ title, value, icon, active, onClick }: {
  title: string; value: string; icon: React.ReactNode; active?: boolean; onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "bg-card border rounded-lg p-4 text-left w-full transition-colors",
        active ? "border-primary" : "border-border",
        onClick && "hover:border-primary",
      )}
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs">{title}</span>
        {icon}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </Tag>
  );
}


function ShiftCard({ s, onOpen, live }: { s: any; onOpen: () => void; live?: boolean }) {
  const h = Math.floor((s.duration_minutes ?? 0) / 60);
  const m = (s.duration_minutes ?? 0) % 60;
  return (
    <button onClick={onOpen} className="text-left bg-card border border-border hover:border-primary rounded-lg p-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{s.cashier?.nickname ?? s.cashier?.email ?? "—"}</div>
        {live && <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">открыта</span>}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {s.branch?.name ?? "Без филиала"} · {new Date(s.started_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        {s.ended_at && <> — {new Date(s.ended_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><div className="text-[10px] text-muted-foreground">Выручка</div><div className="font-semibold">{formatUZS(s.stats?.total ?? 0)}</div></div>
        <div><div className="text-[10px] text-muted-foreground">Нал</div><div>{formatUZS(s.stats?.cash ?? 0)}</div></div>
        <div><div className="text-[10px] text-muted-foreground">Карта</div><div>{formatUZS(s.stats?.card ?? 0)}</div></div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{h}ч {m}м · {s.stats?.count ?? 0} чек.</span>
        {s.cash_diff !== null && s.cash_diff !== undefined && (
          <span className={cn(
            Number(s.cash_diff) === 0 ? "text-primary" : Number(s.cash_diff) < 0 ? "text-destructive" : "text-yellow-500",
          )}>
            расхожд.: {formatUZS(Number(s.cash_diff))}
          </span>
        )}
        <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
}

function ShiftDetail({ data }: { data: any }) {
  const { shift, stats, sales } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <Info label="Открытие" value={new Date(shift.started_at).toLocaleString("ru-RU")} />
        <Info label="Закрытие" value={shift.ended_at ? new Date(shift.ended_at).toLocaleString("ru-RU") : "открыта"} />
        <Info label="Остаток при открытии" value={formatUZS(shift.opening_cash ?? 0)} />
        <Info label="Продажи наличными" value={formatUZS(stats.cash)} />
        <Info label="Продажи картой" value={formatUZS(stats.card)} />
        <Info label="Ожидалось в кассе" value={shift.closing_cash_expected != null ? formatUZS(shift.closing_cash_expected) : "—"} />
        <Info label="Фактически" value={shift.closing_cash_actual != null ? formatUZS(shift.closing_cash_actual) : "—"} />
        <Info label="Расхождение" value={shift.cash_diff != null ? formatUZS(shift.cash_diff) : "—"} />
      </div>
      <div>
        <h4 className="font-semibold mb-2">Продажи ({sales.length})</h4>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {sales.length === 0 ? (
            <div className="text-sm text-muted-foreground">Продаж нет</div>
          ) : sales.map((s: any) => (
            <div key={s.id} className="bg-muted/30 rounded-md p-2 text-sm">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}{s.payment_method}
                </span>
                <span className="font-semibold">{formatUZS(s.total)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {(s.sale_items ?? []).map((i: any, idx: number) => (
                  <span key={idx}>{i.product_name}{i.variant_size ? ` (${i.variant_size})` : ""} × {i.qty}{idx < s.sale_items.length - 1 ? ", " : ""}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-md p-2">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
