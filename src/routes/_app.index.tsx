import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { LogOut, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useContas } from "@/lib/queries";
import { ContaCard } from "@/components/ContaCard";
import { formatBRL } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { requestNotificationPermissions, agendarNotificacoesContas } from "@/lib/notifications";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Resumo Financeiro — Contas Fácil" },
      { name: "description", content: "Visão geral do mês: total a pagar, contas atrasadas e próximos vencimentos." },
      { property: "og:title", content: "Resumo Financeiro — Contas Fácil" },
      { property: "og:description", content: "Visão geral do mês: total a pagar, contas atrasadas e próximos vencimentos." },
    ],
  }),
});

function Dashboard() {
  const { user, signOut } = useAuth();
  const { data: contas = [], isLoading } = useContas();

  const stats = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const doMes = contas.filter((c) => c.vencimento.startsWith(ym));
    const totalMes = doMes.reduce((s, c) => s + Number(c.valor), 0);
    const atrasadas = contas.filter((c) => c.status === "atrasada");
    const totalAtrasado = atrasadas.reduce((s, c) => s + Number(c.valor), 0);
    const pendentes = contas.filter((c) => c.status === "pendente");
    return { totalMes, totalAtrasado, atrasadas, pendentes };
  }, [contas]);

  const proximas = stats.pendentes.slice(0, 5);

  return (
    <div className="px-4 pt-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-muted-foreground">Olá, {user?.email?.split("@")[0]}</p>
          <h1 className="text-xl font-bold">Resumo Financeiro</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sair">
          <LogOut size={20} />
        </Button>
      </header>

      <div
        className="rounded-3xl p-5 text-white shadow-[var(--shadow-elevated)] mb-4"
        style={{ background: "var(--gradient-primary)" }}
      >
        <p className="text-sm opacity-90 flex items-center gap-1.5">
          <TrendingUp size={16} /> Total do mês
        </p>
        <p className="text-3xl font-extrabold mt-1 tabular-nums">{formatBRL(stats.totalMes)}</p>
        <div className="mt-3 flex gap-3 text-xs">
          <span className="bg-white/20 rounded-full px-3 py-1">
            {stats.pendentes.length} pendentes
          </span>
          <span className="bg-white/20 rounded-full px-3 py-1">
            {stats.atrasadas.length} atrasadas
          </span>
        </div>
      </div>

      {stats.atrasadas.length > 0 && (
        <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-4 mb-4 flex items-center gap-3">
          <AlertTriangle className="text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Contas atrasadas</p>
            <p className="text-xs text-muted-foreground">
              {formatBRL(stats.totalAtrasado)} em {stats.atrasadas.length} conta(s)
            </p>
          </div>
        </div>
      )}

      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-3">
          <Clock size={14} /> Próximos vencimentos
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : proximas.length === 0 ? (
          <div className="bg-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Nenhuma conta pendente. 🎉
          </div>
        ) : (
          <div className="space-y-2.5">
            {proximas.map((c) => <ContaCard key={c.id} conta={c} />)}
          </div>
        )}
      </section>
    </div>
  );
}
