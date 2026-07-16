import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-hooks";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (role === "admin") return <Navigate to="/admin" />;
  return <Navigate to="/pos" />;
}
