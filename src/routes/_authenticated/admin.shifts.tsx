import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Clock, Plus, Trash2, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth-hooks";
import { listShifts } from "@/lib/shifts.functions";
import { listSchedules, createSchedule, deleteSchedule } from "@/lib/schedules.functions";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatUZS } from "@/lib/format";

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
  if (role !== "admin") return <div className="p-6 text-muted-foreground">Только для админа</div>;

  return (
    <div className="p-6 h-screen overflow-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4"><Clock />Смены</h1>
      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule"><Calendar className="w-4 h-4 mr-1" />Расписание</TabsTrigger>
          <TabsTrigger value="actual"><Clock className="w-4 h-4 mr-1" />Факт</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="mt-4"><ScheduleTab /></TabsContent>
        <TabsContent value="actual" className="mt-4"><ActualTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ScheduleTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [r, cashiers, br] = await Promise.all([
      listSchedules({ data: {} }),
      supabase
        .from("user_roles")
        .select("user_id, profiles(id, nickname, email, branch_id)")
        .eq("role", "cashier"),
      supabase.from("branches").select("id, name").order("name"),
    ]);
    setRows(r as any[]);
    setWorkers((cashiers.data ?? []).map((x: any) => x.profiles).filter(Boolean));
    setBranches(br.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function del(id: string) {
    if (!confirm("Удалить смену из расписания?")) return;
    try { await deleteSchedule({ data: { id } }); toast.success("Удалено"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" />Добавить смену</Button>
          </DialogTrigger>
          <NewScheduleDialog workers={workers} branches={branches} onDone={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>
      {loading && <div className="text-muted-foreground">Загрузка...</div>}
      {!loading && rows.length === 0 && <div className="text-muted-foreground">Расписание пустое</div>}
      <div className="grid gap-2">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{r.worker?.nickname ?? r.worker?.email ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{r.branch?.name ?? "Без филиала"}</div>
                <div className="text-sm mt-1 font-mono">{fmt(r.starts_at)} → {fmt(r.ends_at)}</div>
                {r.note && <div className="text-sm text-muted-foreground mt-1">{r.note}</div>}
              </div>
              <div className="text-right text-sm">
                <div className="text-xs text-muted-foreground">За смену</div>
                <div className="font-bold text-primary">{formatUZS(r.stats.total)}</div>
                <div className="text-xs">Чеков: {r.stats.count}</div>
                <div className="text-xs">Нал: {formatUZS(r.stats.cash)} · Карта: {formatUZS(r.stats.card)}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del(r.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewScheduleDialog({ workers, branches, onDone }: { workers: any[]; branches: any[]; onDone: () => void }) {
  const [worker, setWorker] = useState("");
  const [branch, setBranch] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!worker || !start || !end) { toast.error("Заполните обязательные поля"); return; }
    if (new Date(end) <= new Date(start)) { toast.error("Конец должен быть позже начала"); return; }
    setBusy(true);
    try {
      await createSchedule({ data: {
        worker_id: worker,
        branch_id: branch || null,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        note: note || null,
      } });
      toast.success("Смена добавлена");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Новая смена</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Работник</Label>
          <Select value={worker} onValueChange={setWorker}>
            <SelectTrigger><SelectValue placeholder="Выбрать..." /></SelectTrigger>
            <SelectContent>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.nickname ?? w.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Филиал</Label>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger><SelectValue placeholder="Не указан" /></SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Начало</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>Конец</Label>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Комментарий</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="необязательно" />
        </div>
        <Button className="w-full" onClick={save} disabled={busy}>Сохранить</Button>
      </div>
    </DialogContent>
  );
}

function ActualTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listShifts({ data: {} })
      .then((r) => setRows(r as any[]))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="space-y-4">
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
