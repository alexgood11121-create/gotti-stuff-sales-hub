import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveCashierEmail } from "@/lib/cashiers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Store } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/" });
    });
  }, [nav]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 bg-card border-border">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center text-primary-foreground">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Gotti Stuff</h1>
          <p className="text-sm text-muted-foreground">POS для планшета</p>
        </div>
        <Tabs defaultValue="cashier">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="cashier">Кассир</TabsTrigger>
            <TabsTrigger value="admin">Админ</TabsTrigger>
          </TabsList>
          <TabsContent value="cashier"><CashierForm /></TabsContent>
          <TabsContent value="admin"><AdminForm /></TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function CashierForm() {
  const [nickname, setNick] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { email } = await resolveCashierEmail({ data: { nickname } });
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
      if (error) throw error;
      toast.success("Добро пожаловать");
      nav({ to: "/pos" });
    } catch (e: any) {
      toast.error(e.message ?? "Неверный никнейм или PIN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pt-4">
      <div>
        <Label>Никнейм</Label>
        <Input value={nickname} onChange={(e) => setNick(e.target.value)} required autoFocus placeholder="ivan" />
      </div>
      <div>
        <Label>PIN-код</Label>
        <Input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" required placeholder="4-8 цифр" />
      </div>
      <Button className="w-full" type="submit" disabled={loading}>{loading ? "..." : "Войти"}</Button>
      <p className="text-xs text-muted-foreground text-center">Никнейм и PIN выдаёт администратор</p>
    </form>
  );
}

function AdminForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Регистрация выполнена");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav({ to: "/" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pt-4">
      <div>
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <Label>Пароль</Label>
        <Input type="password" value={password} onChange={(e) => setPass(e.target.value)} required minLength={6} />
      </div>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "..." : mode === "signup" ? "Зарегистрироваться" : "Войти"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
      >
        {mode === "signin" ? "Первый вход? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </button>
      <p className="text-xs text-muted-foreground text-center">
        Первый зарегистрированный аккаунт становится администратором
      </p>
    </form>
  );
}
