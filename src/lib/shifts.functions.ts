import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { branch_id: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Close any dangling open shift for this cashier
    const { data: open } = await supabase
      .from("shifts")
      .select("id")
      .eq("cashier_id", userId)
      .is("ended_at", null)
      .maybeSingle();
    if (open) return { id: open.id, already: true };

    const { data: row, error } = await supabase
      .from("shifts")
      .insert({ cashier_id: userId, branch_id: data.branch_id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, already: false };
  });

export const endShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: open } = await supabase
      .from("shifts")
      .select("id")
      .eq("cashier_id", userId)
      .is("ended_at", null)
      .maybeSingle();
    if (!open) return { closed: false };
    const { error } = await supabase
      .from("shifts")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", open.id);
    if (error) throw new Error(error.message);
    return { closed: true, id: open.id };
  });

export const getMyOpenShift = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("shifts")
      .select("id, started_at, branch_id")
      .eq("cashier_id", userId)
      .is("ended_at", null)
      .maybeSingle();
    return data;
  });

export const listShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number }) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("shifts")
      .select("id, cashier_id, branch_id, started_at, ended_at")
      .order("started_at", { ascending: false })
      .limit(data.limit ?? 200);
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
    return (rows ?? []).map((r) => ({
      ...r,
      cashier: pmap.get(r.cashier_id) ?? null,
      branch: r.branch_id ? bmap.get(r.branch_id) ?? null : null,
      duration_minutes: r.ended_at
        ? Math.max(0, Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000))
        : null,
    }));
  });
