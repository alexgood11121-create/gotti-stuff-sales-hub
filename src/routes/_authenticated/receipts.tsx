import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatUZS } from "@/lib/format";
import { useAuth } from "@/lib/auth-hooks";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/receipts")({
  ssr: false,
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const { role, user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    let q = supabase
      .from("sales")
      .select("id,created_at,total,payment_method,cash_amount,card_amount,cashier_id,branches(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (role === "cashier") q = q.eq("cashier_id", user.id);
    q.then(({ data }) => setSales(data ?? []));
  }, [user, role]);

  return (
    <div className="p-6 h-screen overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Чеки</h1>
      <div className="space-y-2">
        {sales.length === 0 && <div className="text-muted-foreground">Пока нет чеков</div>}
        {sales.map((s) => (
          <Card key={s.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-xs text-muted-foreground">#{s.id.slice(0, 8)}</div>
              <div className="text-sm">{formatDate(s.created_at)}</div>
              <div className="text-xs text-muted-foreground">
                {s.branches?.name ?? "—"} · {s.profiles?.nickname ?? "—"} · {payLabel(s.payment_method)}
              </div>
            </div>
            <div className="text-xl font-bold text-primary">{formatUZS(s.total)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function payLabel(m: string) {
  return m === "cash" ? "Наличные" : m === "card" ? "Карта" : "Смешанная";
}
