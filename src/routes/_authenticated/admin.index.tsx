import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatUZS, formatDate, today } from "@/lib/format";
import { useAuth } from "@/lib/auth-hooks";
import { Bell, Store, TrendingUp, Wallet, CreditCard, Banknote } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: AdminDash,
});

function AdminDash() {
  const { role } = useAuth();
  const [byBranch, setByBranch] = useState<any[]>([]);
  const [byMethod, setByMethod] = useState<any[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, count: 0, cash: 0, card: 0 });
  const [notifs, setNotifs] = useState<any[]>([]);
  const [byDay, setByDay] = useState<any[]>([]);

  useEffect(() => {
    if (role !== "admin") return;
    load();
    const ch = supabase
      .channel("dash-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [role]);

  async function load() {
    const { from, to } = today();
    const { data: sales } = await supabase
      .from("sales")
      .select("total,cash_amount,card_amount,payment_method,branch_id,branches(name),created_at")
      .gte("created_at", from).lte("created_at", to);
    const revenue = (sales ?? []).reduce((s, x: any) => s + Number(x.total), 0);
    const cash = (sales ?? []).reduce((s, x: any) => s + Number(x.cash_amount ?? 0), 0);
    const card = (sales ?? []).reduce((s, x: any) => s + Number(x.card_amount ?? 0), 0);
    setTotals({ revenue, count: sales?.length ?? 0, cash, card });

    const branchMap = new Map<string, number>();
    (sales ?? []).forEach((s: any) => {
      const key = s.branches?.name ?? "Без филиала";
      branchMap.set(key, (branchMap.get(key) ?? 0) + Number(s.total));
    });
    setByBranch(Array.from(branchMap, ([name, value]) => ({ name, value })));

    setByMethod([
      { name: "Наличные", value: cash },
      { name: "Карта", value: card },
    ]);

    const week = new Date();
    week.setDate(week.getDate() - 6);
    week.setHours(0, 0, 0, 0);
    const { data: w } = await supabase.from("sales").select("created_at,total").gte("created_at", week.toISOString());
    const map = new Map<string, number>();
    (w ?? []).forEach((s: any) => {
      const d = new Date(s.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
      map.set(d, (map.get(d) ?? 0) + Number(s.total));
    });
    setByDay(Array.from(map, ([day, value]) => ({ day, value })));

    const { data: n } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    setNotifs(n ?? []);
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  }

  if (role !== "admin") {
    return <div className="p-6 text-muted-foreground">Только для админа</div>;
  }

  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

  return (
    <div className="p-6 h-screen overflow-auto space-y-4">
      <h1 className="text-2xl font-bold">Дашборд — сегодня</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<TrendingUp />} label="Выручка" value={formatUZS(totals.revenue)} />
        <Stat icon={<Wallet />} label="Чеков" value={String(totals.count)} />
        <Stat icon={<Banknote />} label="Наличные" value={formatUZS(totals.cash)} />
        <Stat icon={<CreditCard />} label="Карта" value={formatUZS(totals.card)} />
      </div>

      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">Аналитика</TabsTrigger>
          <TabsTrigger value="notif">
            <Bell className="w-4 h-4 mr-1" />Уведомления
            {notifs.filter((n) => !n.is_read).length > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5">
                {notifs.filter((n) => !n.is_read).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Store className="w-4 h-4" />По филиалам (сегодня)</h3>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={byBranch}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" stroke="#888" />
                    <YAxis stroke="#888" tickFormatter={(v) => v / 1000 + "k"} />
                    <Tooltip formatter={(v: any) => formatUZS(v)} contentStyle={{ background: "#222", border: "1px solid #333" }} />
                    <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Способ оплаты</h3>
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byMethod} dataKey="value" nameKey="name" outerRadius={80} label={(e: any) => e.name}>
                      {byMethod.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(v: any) => formatUZS(v)} contentStyle={{ background: "#222", border: "1px solid #333" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Продажи за 7 дней</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" stroke="#888" />
                  <YAxis stroke="#888" tickFormatter={(v) => v / 1000 + "k"} />
                  <Tooltip formatter={(v: any) => formatUZS(v)} contentStyle={{ background: "#222", border: "1px solid #333" }} />
                  <Bar dataKey="value" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notif" className="space-y-2">
          {notifs.length === 0 && <div className="text-muted-foreground">Нет уведомлений</div>}
          {notifs.map((n) => (
            <Card key={n.id} className={`p-4 ${!n.is_read ? "border-primary" : ""}`} onClick={() => !n.is_read && markRead(n.id)}>
              <div className="flex justify-between">
                <div className="font-semibold">{n.title}</div>
                <div className="text-xs text-muted-foreground">{formatDate(n.created_at)}</div>
              </div>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans mt-2">{n.body}</pre>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
