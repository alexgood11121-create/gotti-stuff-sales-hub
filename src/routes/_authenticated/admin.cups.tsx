import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CupSoda, Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  deactivateCupType,
  listAllCupTypes,
  listAllocations,
  saveAllocations,
  saveCupType,
  todayKey,
} from "@/lib/cups";
import type { CachedCupType } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/admin/cups")({
  ssr: false,
  component: AdminCupsPage,
});

function AdminCupsPage() {
  const { role } = useAuth();
  if (role !== "admin") return <div className="p-6 text-muted-foreground">Только для админа</div>;

  return (
    <div className="p-4 md:p-6 min-h-full overflow-x-hidden">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4"><CupSoda />Стаканы</h1>
      <Tabs defaultValue="issue">
        <TabsList>
          <TabsTrigger value="issue">Выдача на день</TabsTrigger>
          <TabsTrigger value="types">Типы стаканов</TabsTrigger>
        </TabsList>
        <TabsContent value="issue" className="mt-4"><IssueTab /></TabsContent>
        <TabsContent value="types" className="mt-4"><TypesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function TypesTab() {
  const [rows, setRows] = useState<CachedCupType[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CachedCupType | null>(null);
  const [name, setName] = useState("");
  const [material, setMaterial] = useState("craft");
  const [volume, setVolume] = useState("350");
  const [sort, setSort] = useState("0");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setRows(await listAllCupTypes()), []);
  useEffect(() => { load(); }, [load]);

  function startNew() {
    setEdit(null); setName(""); setMaterial("craft"); setVolume("350"); setSort(String(rows.length)); setOpen(true);
  }
  function startEdit(c: CachedCupType) {
    setEdit(c); setName(c.name); setMaterial(c.material); setVolume(String(c.volume_ml)); setSort(String(c.sort_order)); setOpen(true);
  }

  async function submit() {
    if (!name.trim()) { toast.error("Введите название"); return; }
    setBusy(true);
    try {
      await saveCupType({
        id: edit?.id,
        name: name.trim(),
        material,
        volume_ml: Number(volume) || 0,
        sort_order: Number(sort) || 0,
        is_active: edit ? edit.is_active : true,
      });
      toast.success("Сохранено");
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 max-w-2xl">
      <Button onClick={startNew}><Plus className="w-4 h-4 mr-1" />Новый тип</Button>
      {rows.map((c) => (
        <Card key={c.id} className="p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="font-semibold">{c.name}</div>
            <div className="text-xs text-muted-foreground">
              {c.material === "craft" ? "Крафт" : "Пластик"} · {c.volume_ml} мл{c.is_active ? "" : " · скрыт"}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => startEdit(c)}>Изменить</Button>
          {c.is_active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await deactivateCupType(c.id); await load(); }}
            ><Trash2 className="w-4 h-4" /></Button>
          )}
        </Card>
      ))}
      {rows.length === 0 && <div className="text-sm text-muted-foreground">Типов пока нет</div>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{edit ? "Изменить тип" : "Новый тип стакана"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Крафт 350" /></div>
            <div>
              <Label>Материал</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="craft">Крафт</SelectItem>
                  <SelectItem value="plastic">Пластик</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Объём, мл</Label><Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} /></div>
            <div><Label>Порядок</Label><Input type="number" value={sort} onChange={(e) => setSort(e.target.value)} /></div>
            <Button className="w-full h-11" disabled={busy} onClick={submit}><Save className="w-4 h-4 mr-1" />Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IssueTab() {
  const [types, setTypes] = useState<CachedCupType[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [cashierId, setCashierId] = useState<string>("");
  const [date, setDate] = useState(todayKey());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await listAllCupTypes();
      setTypes(all.filter((c) => c.is_active));
      const { data } = await supabase.from("profiles").select("id,nickname,email,branch_id").order("nickname");
      setCashiers(data ?? []);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!cashierId) { setQty({}); return; }
    const rows = await listAllocations(cashierId, date);
    setQty(Object.fromEntries(rows.map((r) => [r.cup_type_id, String(r.qty)])));
  }, [cashierId, date]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!cashierId) { toast.error("Выберите кассира"); return; }
    const cashier = cashiers.find((c) => c.id === cashierId);
    const payload: Record<string, number> = {};
    for (const t of types) payload[t.id] = Number(qty[t.id] ?? 0) || 0;
    setBusy(true);
    try {
      await saveAllocations({
        cashierId,
        branchId: cashier?.branch_id ?? null,
        forDate: date,
        qtyByCup: payload,
      });
      toast.success("Выдача сохранена — попадёт в смену при её открытии");
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[220px]">
          <Label>Кассир</Label>
          <Select value={cashierId} onValueChange={setCashierId}>
            <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {cashiers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nickname ?? c.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Дата</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </div>

      {types.map((t) => (
        <Card key={t.id} className="p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="font-semibold">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.material === "craft" ? "Крафт" : "Пластик"} · {t.volume_ml} мл</div>
          </div>
          <Input
            type="number"
            inputMode="numeric"
            className="h-10 w-28"
            value={qty[t.id] ?? ""}
            placeholder="0"
            onChange={(e) => setQty((q) => ({ ...q, [t.id]: e.target.value }))}
          />
        </Card>
      ))}
      {types.length === 0 && <div className="text-sm text-muted-foreground">Сначала добавьте типы стаканов</div>}

      <Button className="h-11" disabled={busy || !cashierId} onClick={submit}>
        <Save className="w-4 h-4 mr-1" />Сохранить выдачу
      </Button>
    </div>
  );
}
