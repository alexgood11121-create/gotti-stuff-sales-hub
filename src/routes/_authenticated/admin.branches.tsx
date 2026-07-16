import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Store, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/admin/branches")({
  ssr: false,
  component: BranchesPage,
});

function BranchesPage() {
  const { role } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase.from("branches").select("*").order("name");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  if (role !== "admin") return <div className="p-6 text-muted-foreground">Только для админа</div>;

  async function del(id: string) {
    if (!confirm("Удалить филиал?")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="p-6 h-screen overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store />Филиалы</h1>
        <NewDialog onDone={load} />
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {items.map((b) => (
          <Card key={b.id} className="p-4 flex justify-between items-start">
            <div>
              <div className="font-semibold">{b.name}</div>
              <div className="text-sm text-muted-foreground">{b.address ?? "—"}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del(b.id)}><Trash2 className="w-4 h-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewDialog({ onDone }: any) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddr] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Филиал</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Новый филиал</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("branches").insert({ name, address });
          if (error) return toast.error(error.message);
          toast.success("Создан"); setName(""); setAddr(""); setOpen(false); onDone();
        }} className="space-y-3">
          <div><Label>Название</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><Label>Адрес</Label><Input value={address} onChange={(e) => setAddr(e.target.value)} /></div>
          <Button type="submit" className="w-full">Создать</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
