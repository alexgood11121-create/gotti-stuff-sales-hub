import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-hooks";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, role } = useAuth();
  return (
    <div className="p-6 h-screen overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Настройки</h1>
      <Card className="p-4 space-y-2 max-w-lg">
        <Row label="Роль" value={role === "admin" ? "Администратор" : "Кассир"} />
        <Row label="Никнейм" value={profile?.nickname ?? "—"} />
        <Row label="Email" value={profile?.email ?? "—"} />
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
