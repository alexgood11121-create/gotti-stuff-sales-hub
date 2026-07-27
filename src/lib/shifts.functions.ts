import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { branch_id: string | null; opening_cash: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: open } = await supabase
      .from("shifts")
      .select("id")
      .eq("cashier_id", userId)
      .is("ended_at", null)
      .maybeSingle();
    if (open) return { id: open.id, already: true };

    const { data: row, error } = await supabase
      .from("shifts")
      .insert({
        cashier_id: userId,
        branch_id: data.branch_id,
        opening_cash: Number(data.opening_cash) || 0,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, already: false };
  });

export const endShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { closing_cash_actual: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: open } = await supabase
      .from("shifts")
      .select("id, started_at, opening_cash, branch_id, cashier_id")
      .eq("cashier_id", userId)
      .is("ended_at", null)
      .maybeSingle();
    if (!open) return { closed: false };

    // Считаем ожидаемый остаток: opening + продажи налом (за смену этого кассира)
    const { data: sales } = await supabase
      .from("sales")
      .select("cash_amount")
      .eq("cashier_id", userId)
      .gte("created_at", open.started_at);
    const cashSales = (sales ?? []).reduce((s, x: any) => s + Number(x.cash_amount ?? 0), 0);
    const opening = Number((open as any).opening_cash ?? 0);
    const expected = opening + cashSales;
    const actual = Number(data.closing_cash_actual) || 0;
    const diff = actual - expected;

    const { error } = await supabase
      .from("shifts")
      .update({
        ended_at: new Date().toISOString(),
        closing_cash_expected: expected,
        closing_cash_actual: actual,
        cash_diff: diff,
      } as any)
      .eq("id", open.id);
    if (error) throw new Error(error.message);
    return { closed: true, id: open.id, expected, actual, diff };
  });

export const getMyOpenShift = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("shifts")
      .select("id, started_at, branch_id, opening_cash")
      .eq("cashier_id", userId)
      .is("ended_at", null)
      .maybeSingle();
    return data as any;
  });

export const getExpectedCash = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: open } = await supabase
      .from("shifts")
      .select("id, started_at, opening_cash")
      .eq("cashier_id", userId)
      .is("ended_at", null)
      .maybeSingle();
    if (!open) return { expected: 0, opening: 0, cashSales: 0 };
    const { data: sales } = await supabase
      .from("sales")
      .select("cash_amount")
      .eq("cashier_id", userId)
      .gte("created_at", open.started_at);
    const cashSales = (sales ?? []).reduce((s, x: any) => s + Number(x.cash_amount ?? 0), 0);
    const opening = Number((open as any).opening_cash ?? 0);
    return { expected: opening + cashSales, opening, cashSales };
  });

export const listShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number; branch_id?: string | null; cashier_id?: string | null }) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("shifts")
      .select("id, cashier_id, branch_id, started_at, ended_at, opening_cash, closing_cash_expected, closing_cash_actual, cash_diff")
      .order("started_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.branch_id) q = q.eq("branch_id", data.branch_id);
    if (data.cashier_id) q = q.eq("cashier_id", data.cashier_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const cashierIds = Array.from(new Set((rows ?? []).map((r) => r.cashier_id)));
    const branchIds = Array.from(new Set((rows ?? []).map((r) => r.branch_id).filter(Boolean))) as string[];
    const [{ data: profs }, { data: brs }] = await Promise.all([
      cashierIds.length
        ? supabase.from("profiles").select("id, nickname, email").in("id", cashierIds)
        : Promise.resolve({ data: [] as any[] }),
      branchIds.length
        ? supabase.from("branches").select("id, name").in("id", branchIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const bmap = new Map((brs ?? []).map((b: any) => [b.id, b]));

    // Totals per shift
    const results: any[] = [];
    for (const r of rows ?? []) {
      const endBound = r.ended_at ?? new Date().toISOString();
      const { data: sales } = await supabase
        .from("sales")
        .select("total, cash_amount, card_amount, payment_method")
        .eq("cashier_id", r.cashier_id)
        .gte("created_at", r.started_at)
        .lte("created_at", endBound);
      const stats = (sales ?? []).reduce(
        (acc, s: any) => {
          acc.total += Number(s.total ?? 0);
          acc.cash += Number(s.cash_amount ?? 0);
          acc.card += Number(s.card_amount ?? 0);
          acc.count += 1;
          return acc;
        },
        { total: 0, cash: 0, card: 0, count: 0 },
      );
      results.push({
        ...r,
        cashier: pmap.get(r.cashier_id) ?? null,
        branch: r.branch_id ? bmap.get(r.branch_id) ?? null : null,
        duration_minutes: r.ended_at
          ? Math.max(0, Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000))
          : Math.max(0, Math.round((Date.now() - new Date(r.started_at).getTime()) / 60000)),
        stats,
      });
    }
    return results;
  });

export const getShiftDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: shift, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const endBound = shift.ended_at ?? new Date().toISOString();
    const [{ data: sales }, { data: movements }, { data: prof }, { data: br }] = await Promise.all([
      supabase
        .from("sales")
        .select("id, total, cash_amount, card_amount, given_amount, change_amount, payment_method, created_at, sale_items(product_name, qty, unit_price, total, variant_size)")
        .eq("cashier_id", shift.cashier_id)
        .gte("created_at", shift.started_at)
        .lte("created_at", endBound)
        .order("created_at", { ascending: false }),
      supabase
        .from("stock_movements")
        .select("id, type, amount, note, created_at, product_id, qty")
        .eq("user_id", shift.cashier_id)
        .gte("created_at", shift.started_at)
        .lte("created_at", endBound)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nickname, email").eq("id", shift.cashier_id).maybeSingle(),
      shift.branch_id
        ? supabase.from("branches").select("id, name").eq("id", shift.branch_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const stats = (sales ?? []).reduce(
      (acc, s: any) => {
        acc.total += Number(s.total ?? 0);
        acc.cash += Number(s.cash_amount ?? 0);
        acc.card += Number(s.card_amount ?? 0);
        acc.count += 1;
        return acc;
      },
      { total: 0, cash: 0, card: 0, count: 0 },
    );
    const income = (movements ?? []).filter((m: any) => m.type === "income").reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0);
    const expense = (movements ?? []).filter((m: any) => m.type === "expense").reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0);
    return {
      shift,
      cashier: prof,
      branch: br,
      sales: sales ?? [],
      movements: movements ?? [],
      stats: { ...stats, income, expense },
    };
  });
