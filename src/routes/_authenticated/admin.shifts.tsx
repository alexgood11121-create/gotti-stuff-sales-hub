import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-hooks";
import { listShifts } from "@/lib/shifts.functions";

export const Route = createFileRoute("/_authenticated/admin/shifts")({
  ssr: false,
  component: ShiftsPage,
});

function fmt(dt: string) {
  return new Date(dt).toLocaleString("ru-RU");
}

function fmtDur(mins: number | null) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

function ShiftsPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listShifts({ data: {} })
      .then((r) => setRows(r as any[]))
      .finally(() => setLoading(false));
  }, []);

  if (role !== "admin") return <div className="p-6 text-muted-foreground">Только для админа</div>;

  const totalHoursByCashier = new Map<string, { name: string; minutes: number }>();
  rows.forEach((r) => {
    if (r.duration_minutes == null) return;
    const key = r.cashier_id;
    const name = r.cashier?.nickname ?? r.cashier?.email ?? "—";
    const cur = totalHoursByCashier.get(key) ?? { name, minutes: 0 };
    cur.minutes += r.duration_minutes;
    totalHoursByCashier.set(key, cur);
  });

  return (
    <div className="p-6 h-screen overflow-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Clock />Смены</h1>

      {totalHoursByCashier.size > 0 && (
        <div>
          <div className="text-sm text-muted-foreground mb-2">Итого по кассирам</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from(totalHoursByCashier.values()).map((v) => (
              <Card key={v.name} className="p-3">
                <div className="text-xs text-muted-foreground">{v.name}</div>
                <div className="text-lg font-semibold">{fmtDur(v.minutes)}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && <div className="text-muted-foreground">Загрузка...</div>}
        {!loading && rows.length === 0 && <div className="text-muted-foreground">Смен пока нет</div>}
        {rows.map((r) => (
          <Card key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{r.cashier?.nickname ?? r.cashier?.email ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{r.branch?.name ?? "Без филиала"}</div>
            </div>
            <div className="text-sm">
              <div>Начало: <span className="font-mono">{fmt(r.started_at)}</span></div>
              <div>Конец: <span className="font-mono">{r.ended_at ? fmt(r.ended_at) : "— открыта —"}</span></div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Часы</div>
              <div className="text-lg font-bold text-primary">{fmtDur(r.duration_minutes)}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
