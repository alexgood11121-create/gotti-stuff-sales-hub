import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listShifts, getShiftDetails } from "@/lib/shifts.functions";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatUZS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, Banknote, CreditCard, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: AdminDashboard,
});

function AdminDashboard() {
  const [selected, setSelected] = useState<string | null>(null);

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

  const shifts = shiftsQ.data ?? [];
  const openNow = shifts.filter((s: any) => !s.ended_at);
  const todayISO = new Date().toISOString().slice(0, 10);
  const today = shifts.filter((s: any) => (s.started_at as string).slice(0, 10) === todayISO);
  const todayTotal = today.reduce((sum: number, s: any) => sum + Number(s.stats?.total ?? 0), 0);
  const todayCash = today.reduce((sum: number, s: any) => sum + Number(s.stats?.cash ?? 0), 0);
  const todayCard = today.reduce((sum: number, s: any) => sum + Number(s.stats?.card ?? 0), 0);

  return (
    <AppShell>
      <div className="p-6 h-screen overflow-y-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Дашборд</h1>
          <p className="text-sm text-muted-foreground">Смены и продажи</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi title="Открытых смен" value={String(openNow.length)} icon={<Clock className="w-5 h-5" />} />
          <Kpi title="Сегодня выручка" value={formatUZS(todayTotal)} icon={<TrendingUp className="w-5 h-5" />} />
          <Kpi title="Сегодня наличные" value={formatUZS(todayCash)} icon={<Banknote className="w-5 h-5" />} />
          <Kpi title="Сегодня карта" value={formatUZS(todayCard)} icon={<CreditCard className="w-5 h-5" />} />
        </div>

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

function Kpi({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs">{title}</span>
        {icon}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
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
