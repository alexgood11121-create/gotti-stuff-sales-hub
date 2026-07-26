import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createSchema = z.object({
  worker_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  note: z.string().max(500).nullable().optional(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Только для админа");
}

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { worker_id?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("shift_schedules")
      .select("id, worker_id, branch_id, starts_at, ends_at, note")
      .order("starts_at", { ascending: false })
      .limit(200);
    if (data.worker_id) q = q.eq("worker_id", data.worker_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const workerIds = Array.from(new Set((rows ?? []).map((r) => r.worker_id)));
    const branchIds = Array.from(
      new Set((rows ?? []).map((r) => r.branch_id).filter(Boolean)),
    ) as string[];
    const [{ data: profs }, { data: brs }] = await Promise.all([
      workerIds.length
        ? supabase.from("profiles").select("id, nickname, email").in("id", workerIds)
        : Promise.resolve({ data: [] as any[] }),
      branchIds.length
        ? supabase.from("branches").select("id, name").in("id", branchIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const bmap = new Map((brs ?? []).map((b: any) => [b.id, b]));

    // Aggregate sales for each schedule window
    const results = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: sales } = await supabase
          .from("sales")
          .select("total, cash_amount, card_amount")
          .eq("cashier_id", r.worker_id)
          .gte("created_at", r.starts_at)
          .lte("created_at", r.ends_at);
        const stats = (sales ?? []).reduce(
          (acc, s: any) => {
            acc.count += 1;
            acc.total += Number(s.total ?? 0);
            acc.cash += Number(s.cash_amount ?? 0);
            acc.card += Number(s.card_amount ?? 0);
            return acc;
          },
          { count: 0, total: 0, cash: 0, card: 0 },
        );
        return {
          ...r,
          worker: pmap.get(r.worker_id) ?? null,
          branch: r.branch_id ? bmap.get(r.branch_id) ?? null : null,
          stats,
        };
      }),
    );
    return results;
  });

export const createSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("shift_schedules")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("shift_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
