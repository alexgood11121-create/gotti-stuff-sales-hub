import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatUZS, today } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "@/lib/auth-hooks";

export const Route = createFileRoute("/_authenticated/reports")({
  ssr: false,
  component: ReportsPage,
});

function ReportsPage() {
  const { role, user } = useAuth();
  const [stats, setStats] = useState({ revenue: 0, profit: 0, expense: 0, count: 0 });
  const [byDay, setByDay] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { from, to } = today();
      // Sales — сегодня
      let q = supabase.from("sales").select("total").gte("created_at", from).lte("created_at", to);
      if (role === "cashier" && user) q = q.eq("cashier_id", user.id);
      const { data: sales } = await q;
      const revenue = (sales ?? []).reduce((s, x: any) => s + Number(x.total), 0);

      // Profit — по sale_items
      const { data: items } = await supabase
        .from("sale_items")
        .select("qty,unit_price,cost_price,sales!inner(created_at,cashier_id)")
        .gte("sales.created_at", from)
        .lte("sales.created_at", to);
      const profit = (items ?? []).reduce((s, x: any) => s + (Number(x.unit_price) - Number(x.cost_price)) * Number(x.qty), 0);

      const { data: exps } = await supabase
        .from("stock_movements")
        .select("amount")
        .eq("type", "expense")
        .gte("created_at", from)
        .lte("created_at", to);
      const expense = (exps ?? []).reduce((s, x: any) => s + Number(x.amount ?? 0), 0);

      setStats({ revenue, profit, expense, count: sales?.length ?? 0 });

      // По дням — 7 дней
      const week = new Date();
      week.setDate(week.getDate() - 6);
      week.setHours(0, 0, 0, 0);
      const { data: w } = await supabase
        .from("sales")
        .select("created_at,total")
        .gte("created_at", week.toISOString());
      const map = new Map<string, number>();
      (w ?? []).forEach((s: any) => {
        const d = new Date(s.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
        map.set(d, (map.get(d) ?? 0) + Number(s.total));
      });
      const arr = Array.from(map, ([day, value]) => ({ day, value }));
      setByDay(arr);
    })();
  }, [role, user]);

  return (
    <div className="p-6 h-screen overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Отчёты — Сегодня</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Выручка" value={stats.revenue} />
        <Stat label="Прибыль" value={stats.profit} accent />
        <Stat label="Расходы" value={stats.expense} negative />
        <Stat label="Чеков" value={stats.count} raw />
      </div>
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Продажи за 7 дней</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" stroke="#888" />
              <YAxis stroke="#888" tickFormatter={(v) => (v / 1000) + "k"} />
              <Tooltip formatter={(v: any) => formatUZS(v)} contentStyle={{ background: "#222", border: "1px solid #333" }} />
              <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent, negative, raw }: any) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : negative ? "text-destructive" : ""}`}>
        {raw ? value : formatUZS(value)}
      </div>
    </Card>
  );
}
