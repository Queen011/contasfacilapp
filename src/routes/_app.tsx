import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDiagnosticRoute = location.pathname === "/diagnostico";

  useEffect(() => {
    if (!isDiagnosticRoute && !loading && !user) navigate({ to: "/login" });
  }, [isDiagnosticRoute, loading, user, navigate]);

  if (!isDiagnosticRoute && (loading || !user)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="size-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 overflow-x-hidden">
      <main className="w-full max-w-2xl mx-auto overflow-x-hidden">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
