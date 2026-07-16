import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CASHIER_DOMAIN = "cashier.gotti.local";

function nicknameToEmail(nickname: string): string {
  return `${nickname.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}@${CASHIER_DOMAIN}`;
}

const createSchema = z.object({
  nickname: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/, "Только латиница, цифры и _"),
  pin: z.string().regex(/^\d{4,8}$/, "PIN 4-8 цифр"),
  branch_id: z.string().uuid(),
});

export const createCashier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Проверка что вызывающий — админ
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Только админ может создавать кассиров");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = nicknameToEmail(data.nickname);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.pin,
      email_confirm: true,
      user_metadata: {
        nickname: data.nickname,
        role: "cashier",
      },
    });
    if (error) throw new Error(error.message);
    if (!created.user) throw new Error("Не удалось создать пользователя");

    // Обновим профиль (branch_id) — триггер уже создал строку
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ branch_id: data.branch_id, nickname: data.nickname })
      .eq("id", created.user.id);
    if (upErr) throw new Error(upErr.message);

    return { id: created.user.id, nickname: data.nickname, pin: data.pin };
  });

const deleteSchema = z.object({ user_id: z.string().uuid() });

export const deleteCashier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Только админ");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const resolveSchema = z.object({
  nickname: z.string().min(1),
});

// Публичная (без middleware) — резолвит nickname в email для входа кассира
export const resolveCashierEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resolveSchema.parse(input))
  .handler(async ({ data }) => {
    return { email: nicknameToEmail(data.nickname) };
  });
