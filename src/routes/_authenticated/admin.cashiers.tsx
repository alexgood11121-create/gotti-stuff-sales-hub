import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-hooks";
import { createCashier, deleteCashier } from "@/lib/cashiers.functions";

export const Route = createFileRoute("/_authenticated/admin/cashiers")({
  ssr: false,
  component: CashiersPage,
});

function CashiersPage() {
  const { role } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [credentials, setCred] = useState<{ nickname: string; pin: string } | null>(null);

  async function load() {
    // Только кассиры (join user_roles)
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "cashier");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) { setItems([]); }
    else {
      const { data: profs } = await supabase.from("profiles").select("id,nickname,email,branch_id,branches(name)").in("id", ids);
      setItems(profs ?? []);
    }
    const { data: br } = await supabase.from("branches").select("*").order("name");
    setBranches(br ?? []);
  }
  useEffect(() => { load(); }, []);

  if (role !== "admin") return <div className="p-6 text-muted-foreground">Только для админа</div>;

  async function del(id: string) {
    if (!confirm("Удалить кассира?")) return;
    try { await deleteCashier({ data: { user_id: id } }); toast.success("Удалён"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="p-4 md:p-6 min-h-full overflow-x-hidden">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users />Кассиры</h1>
        <NewDialog branches={branches} onDone={(c: any) => { load(); setCred(c); }} />
      </div>

      {credentials && (
        <Card className="p-4 mb-4 border-primary">
          <div className="font-semibold text-primary">Данные для входа кассира:</div>
          <div className="mt-1 grid grid-cols-2 gap-4">
            <div><span className="text-muted-foreground text-sm">Никнейм:</span> <span className="font-mono font-bold">{credentials.nickname}</span></div>
            <div><span className="text-muted-foreground text-sm">PIN:</span> <span className="font-mono font-bold">{credentials.pin}</span></div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">Передайте эти данные кассиру. Больше PIN нельзя посмотреть.</div>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setCred(null)}>Скрыть</Button>
        </Card>
      )}

      <div className="space-y-2">
        {items.length === 0 && <div className="text-muted-foreground">Нет кассиров</div>}
        {items.map((p) => (
          <Card key={p.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-semibold">{p.nickname}</div>
              <div className="text-xs text-muted-foreground">{p.branches?.name ?? "Без филиала"}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewDialog({ branches, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [nickname, setNick] = useState("");
  const [pin, setPin] = useState("");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createCashier({ data: { nickname, pin, branch_id: branch } });
      toast.success("Кассир создан");
      onDone({ nickname, pin });
      setNick(""); setPin(""); setBranch("");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Кассир</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Новый кассир</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Никнейм (латиница)</Label><Input value={nickname} onChange={(e) => setNick(e.target.value)} required pattern="[a-zA-Z0-9_]+" /></div>
          <div><Label>PIN (4-8 цифр)</Label><Input value={pin} onChange={(e) => setPin(e.target.value)} required pattern="\d{4,8}" inputMode="numeric" /></div>
          <div>
            <Label>Филиал</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger><SelectValue placeholder="Выберите филиал" /></SelectTrigger>
              <SelectContent>
                {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={busy || !branch}>Создать</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
