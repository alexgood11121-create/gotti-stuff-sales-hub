import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CupSoda, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-hooks";
import { getMyOpenShift } from "@/lib/shifts.functions";
import { buildCupRows, refreshCupTypes, refreshShiftCups, saveCountedCups, type CupUsageRow } from "@/lib/cups";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cups")({
  ssr: false,
  component: CupsPage,
});

function CupsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CupUsageRow[]>([]);
  const [shift, setShift] = useState<{ id: string; started_at: string } | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    await refreshCupTypes();
    let s: any = null;
    try { s = await getMyOpenShift(); } catch { /* админ или нет смены */ }
    if (s?.id) await refreshShiftCups(s.id);
    setShift(s ? { id: s.id, started_at: s.started_at } : null);
    const list = await buildCupRows({
      shiftId: s?.id ?? null,
      cashierId: user?.id ?? null,
      startedAt: s?.started_at ?? null,
    });
    setRows(list);
    setCounts((prev) => {
      const next = { ...prev };
      for (const r of list) if (next[r.cup.id] == null && r.counted != null) next[r.cup.id] = String(r.counted);
      return next;
    });
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!shift) return;
    const payload: Record<string, number> = {};
    for (const r of rows) {
      const v = counts[r.cup.id];
      if (v != null && v !== "") payload[r.cup.id] = Number(v);
    }
    if (!Object.keys(payload).length) { toast.error("Введите количество"); return; }
    setBusy(true);
    try {
      await saveCountedCups(shift.id, payload);
      toast.success("Сверка сохранена");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка");
    } finally { setBusy(false); }
  }

  return (
    <div className="p-4 md:p-6 min-h-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CupSoda />Стаканы</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Обновить</Button>
      </div>

      {!shift && !loading && (
        <div className="text-sm text-muted-foreground mb-4">
          Смена не открыта — показаны только типы стаканов. Расход считается по открытой смене.
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.cup.id} className="p-4 flex flex-wrap items-center gap-4">
            <div className="min-w-[140px]">
              <div className="font-semibold">{r.cup.name}</div>
              <div className="text-xs text-muted-foreground">
                {r.cup.material === "craft" ? "Крафт" : "Пластик"} · {r.cup.volume_ml} мл
              </div>
            </div>
            <Stat label="Выдано" value={r.issued} />
            <Stat label="Использовано" value={r.used} />
            <Stat label="Остаток" value={r.left} accent />
            <div className="ml-auto flex items-end gap-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Факт</div>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="h-10 w-28"
                  value={counts[r.cup.id] ?? ""}
                  onChange={(e) => setCounts((c) => ({ ...c, [r.cup.id]: e.target.value }))}
                  disabled={!shift}
                />
              </div>
              <div className="w-24 text-right">
                <div className="text-xs text-muted-foreground">Расхождение</div>
                <div className={cn(
                  "font-semibold",
                  counts[r.cup.id] == null || counts[r.cup.id] === ""
                    ? "text-muted-foreground"
                    : Number(counts[r.cup.id]) - r.left === 0
                      ? "text-primary"
                      : "text-destructive",
                )}>
                  {counts[r.cup.id] == null || counts[r.cup.id] === "" ? "—" : Number(counts[r.cup.id]) - r.left}
                </div>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && !loading && (
          <div className="text-sm text-muted-foreground">Типы стаканов не настроены</div>
        )}
      </div>

      {shift && rows.length > 0 && (
        <Button className="mt-4 h-11" disabled={busy} onClick={save}>Сохранить сверку</Button>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="min-w-[90px]">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold", accent && "text-primary")}>{value}</div>
    </div>
  );
}
