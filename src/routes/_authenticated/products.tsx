import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatUZS } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/products")({
  ssr: false,
  component: ProductsPage,
});

function ProductsPage() {
  const { role } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showProd, setShowProd] = useState(false);

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*, categories(name)").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts(p ?? []); setCats(c ?? []);
  }
  useEffect(() => { load(); }, []);

  if (role !== "admin") {
    return <div className="p-6 text-muted-foreground">Доступ только для админа</div>;
  }

  async function del(id: string) {
    if (!confirm("Удалить товар?")) return;
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалён");
    load();
  }

  return (
    <div className="p-6 h-screen overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Товары</h1>
        <div className="flex gap-2">
          <CategoryDialog onDone={load} />
          <Button onClick={() => { setEditing(null); setShowProd(true); }}>
            <Plus className="w-4 h-4 mr-1" />Товар
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.filter(p => p.is_active).map((p) => (
          <Card key={p.id} className="p-3">
            <div className="aspect-square rounded bg-muted overflow-hidden mb-2 flex items-center justify-center">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-muted-foreground" />}
            </div>
            <div className="font-medium text-sm">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.categories?.name ?? "Без категории"} · Ост.: {p.stock}</div>
            <div className="flex justify-between items-center mt-2">
              <div>
                <div className="text-primary font-semibold">{formatUZS(p.sale_price)}</div>
                <div className="text-xs text-muted-foreground">Закуп: {formatUZS(p.cost_price)}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setShowProd(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ProductDialog open={showProd} onOpenChange={setShowProd} editing={editing} cats={cats} onDone={load} />
    </div>
  );
}

function ProductDialog({ open, onOpenChange, editing, cats, onDone }: any) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [sale, setSale] = useState("");
  const [cat, setCat] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name); setCost(String(editing.cost_price));
      setSale(String(editing.sale_price)); setCat(editing.category_id ?? "");
      setImageUrl(editing.image_url ?? "");
    } else {
      setName(""); setCost(""); setSale(""); setCat(""); setImageUrl("");
    }
  }, [editing, open]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      const url = (await data)?.signedUrl ?? "";
      setImageUrl(url);
      toast.success("Фото загружено");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name, cost_price: Number(cost), sale_price: Number(sale),
      category_id: cat || null, image_url: imageUrl || null,
    };
    const q = editing
      ? supabase.from("products").update(payload).eq("id", editing.id)
      : supabase.from("products").insert({ ...payload, is_active: true });
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    onOpenChange(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Редактирование" : "Новый товар"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-muted-foreground" />}
            </div>
            <label className="flex-1">
              <Button type="button" variant="outline" size="sm" asChild>
                <div className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />{uploading ? "Загрузка..." : "Загрузить фото"}
                </div>
              </Button>
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          <div><Label>Название</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Закуп. цена</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} required /></div>
            <div><Label>Продаж. цена</Label><Input type="number" value={sale} onChange={(e) => setSale(e.target.value)} required /></div>
          </div>
          <div>
            <Label>Категория</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue placeholder="Без категории" /></SelectTrigger>
              <SelectContent>
                {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>Сохранить</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({ onDone }: any) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-1" />Категория</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Новая категория</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("categories").insert({ name });
          if (error) return toast.error(error.message);
          toast.success("Создана"); setName(""); setOpen(false); onDone();
        }} className="space-y-3">
          <div><Label>Название</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <Button type="submit" className="w-full">Создать</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
