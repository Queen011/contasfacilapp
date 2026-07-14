import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, LogOut, TrendingUp, AlertTriangle, Clock, BarChart3, Pencil, Tag, Sparkles, Users } from "lucide-react";
import { PerfilSwitcher } from "@/components/PerfilSwitcher";
// (diagnóstico removido)
import { useAuth } from "@/lib/auth";
import { useContas, useContasTodos } from "@/lib/queries";
import { useActivePerfilId, usePerfis } from "@/lib/perfis";
import { useProfile, useUpdateNome } from "@/lib/profile";
import { ContaCard } from "@/components/ContaCard";
import { formatBRL } from "@/lib/finance";
import { Button } from "@/components/ui/button";

import {
  requestNotificationPermissions,
  agendarNotificacoesContas,
  getNotificationStatus,
  dispararNotificacaoTeste,
  abrirConfiguracoesNotificacao,
  type NotificationStatus,
} from "@/lib/notifications";
import { iconeContasFacilUrl } from "@/lib/app-assets";
import { toast } from "sonner";

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
  const { data: contasTodos = [] } = useContasTodos();
  const { data: perfis = [] } = usePerfis();
  const [activePerfilId] = useActivePerfilId();
  const { data: profile } = useProfile(user?.id);
  const updateNome = useUpdateNome(user?.id);
  const [notifStatus, setNotifStatus] = useState<NotificationStatus>({ state: "prompt", platform: "web" });
  const [checkingNotifications, setCheckingNotifications] = useState(false);
  const notificationsEnabled = notifStatus.state === "granted";

  const syncNotifStatus = async () => {
    const s = await getNotificationStatus();
    setNotifStatus(s);
    return s;
  };

  // Confere permissão real ao montar e sempre que o app volta ao foco
  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      const s = await getNotificationStatus();
      if (mounted) setNotifStatus(s);
    };
    sync();
    const onVis = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", sync);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", sync);
    };
  }, []);

  // Reagenda notificações sempre que a lista de contas mudar (ou o usuário criar/editar
  // uma conta — o mutation invalida ["contas"] e este efeito reroda).
  useEffect(() => {
    if (notifStatus.state !== "granted" && notifStatus.state !== "partial") return;
    if (contas.length === 0) return;
    agendarNotificacoesContas(contas).catch(() => undefined);
  }, [notifStatus.state, contas]);

  const editarNome = () => {
    const atual = profile?.nome ?? "";
    const novo = window.prompt("Seu nome (aparece no topo):", atual);
    if (novo === null) return;
    updateNome.mutate(novo, {
      onSuccess: () => toast.success("Nome atualizado."),
      onError: () => toast.error("Não foi possível salvar o nome."),
    });
  };


  const stats = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const noMes = (c: { vencimento: string; pago_em?: string | null }) =>
      c.vencimento.startsWith(ym) || Boolean(c.pago_em?.startsWith(ym));
    const doMesPerfil = contas.filter(noMes);
    const doMesGeral = contasTodos.filter(noMes);
    const totalPerfilAtivo = doMesPerfil.reduce((s, c) => s + Number(c.valor), 0);
    const totalGeralMes = doMesGeral.reduce((s, c) => s + Number(c.valor), 0);
    const atrasadas = contas.filter((c) => c.status === "atrasada");
    const totalAtrasado = atrasadas.reduce((s, c) => s + Number(c.valor), 0);
    const pendentes = contas.filter((c) => c.status === "pendente");
    return { totalGeralMes, totalPerfilAtivo, totalAtrasado, atrasadas, pendentes };
  }, [contas, contasTodos]);

  const totaisPerfis = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const doMes = contasTodos.filter((c) => c.vencimento.startsWith(ym) || Boolean(c.pago_em?.startsWith(ym)));
    const totalGeral = doMes.reduce((s, c) => s + Number(c.valor), 0);
    const porPerfil = perfis.map((p) => {
      const itens = doMes.filter((c) => c.perfil_id === p.id);
      return {
        perfil: p,
        total: itens.reduce((s, c) => s + Number(c.valor), 0),
        qtd: itens.length,
      };
    });
    const semPerfilItens = doMes.filter((c) => !c.perfil_id);
    const semPerfil = {
      total: semPerfilItens.reduce((s, c) => s + Number(c.valor), 0),
      qtd: semPerfilItens.length,
    };
    return { totalGeral, porPerfil, semPerfil };
  }, [contasTodos, perfis]);

  const donoNome = profile?.nome?.trim() || user?.email?.split("@")[0] || "Você";
  const perfilAtivoNome = useMemo(() => {
    if (!activePerfilId) return donoNome;
    return perfis.find((p) => p.id === activePerfilId)?.nome ?? "Perfil ativo";
  }, [activePerfilId, perfis, donoNome]);


  const toastShownRef = useRef(false);

  // Toast in-app: avisa contas vencendo hoje / amanhã / em 3 dias / atrasadas (1x por sessão)
  useEffect(() => {
    if (toastShownRef.current || contas.length === 0) return;
    toastShownRef.current = true;

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const hojeStr = fmt(hoje);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = fmt(amanha);
    const tresDias = new Date(hoje); tresDias.setDate(tresDias.getDate() + 3);
    const tresDiasStr = fmt(tresDias);

    const vencemHoje = contas.filter((c) => c.status === "pendente" && c.vencimento === hojeStr);
    const vencemAmanha = contas.filter((c) => c.status === "pendente" && c.vencimento === amanhaStr);
    const vencemEm3 = contas.filter((c) => c.status === "pendente" && c.vencimento === tresDiasStr);
    const atrasadas = contas.filter((c) => c.status === "atrasada");

    if (atrasadas.length > 0) {
      toast.error(`${atrasadas.length} conta(s) atrasada(s)`, {
        description: `Total: ${formatBRL(atrasadas.reduce((s, c) => s + Number(c.valor), 0))}`,
      });
    }
    if (vencemHoje.length > 0) {
      toast.warning(`${vencemHoje.length} conta(s) vencem hoje`, {
        description: vencemHoje.map((c) => c.nome).slice(0, 3).join(", "),
      });
    }
    if (vencemAmanha.length > 0) {
      toast(`${vencemAmanha.length} conta(s) vencem amanhã`, {
        description: vencemAmanha.map((c) => c.nome).slice(0, 3).join(", "),
      });
    }
    if (vencemEm3.length > 0) {
      toast(`${vencemEm3.length} conta(s) vencem em 3 dias`, {
        description: vencemEm3.map((c) => c.nome).slice(0, 3).join(", "),
      });
    }
  }, [contas]);

  const enableNotifications = async () => {
    setCheckingNotifications(true);
    // Se já ativado, dispara notificação de teste imediata
    if (notificationsEnabled) {
      const ok = await dispararNotificacaoTeste();
      if (ok) toast.success("Notificação de teste enviada. Se não aparecer, verifique as permissões do sistema.");
      else toast.error("Não foi possível enviar. Verifique as permissões de notificação.");
      setCheckingNotifications(false);
      return;
    }
    const ok = await requestNotificationPermissions();
    await syncNotifStatus();
    if (ok) {
      await agendarNotificacoesContas(contas);
      await dispararNotificacaoTeste();
      toast.success("Notificações ativadas no Contas Fácil.");
    } else {
      toast.error("Permissão negada. Ative em Configurações > Apps > Contas Fácil > Notificações.");
    }
    setCheckingNotifications(false);
  };

  const proximas = stats.pendentes.slice(0, 5);

  return (
    <div className="pad-fluid-x pt-6">
      <header className="flex items-center justify-between gap-2 mb-5 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <img src={iconeContasFacilUrl} alt="Contas Fácil" className="size-12 rounded-2xl shadow-[var(--shadow-card)] shrink-0" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={editarNome}
              className="text-fluid-sm text-muted-foreground truncate flex items-center gap-1 hover:text-foreground transition"
              aria-label="Editar nome"
            >
              <span className="truncate">Olá, {profile?.nome?.trim() || user?.email?.split("@")[0]}</span>
              <Pencil size={12} className="shrink-0 opacity-60" />
            </button>
            <h1 className="text-fluid-lg font-bold truncate">Resumo Financeiro</h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PerfilSwitcher />
          <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sair">
            <LogOut size={20} />
          </Button>
        </div>
      </header>

      <div
        className="rounded-3xl p-5 text-white shadow-[var(--shadow-elevated)] mb-4"
        style={{ background: "var(--gradient-primary)" }}
      >
        <p className="text-fluid-sm opacity-90 flex items-center gap-1.5">
          <TrendingUp size={16} /> Total geral do mês
        </p>
        <p className="text-fluid-money font-extrabold mt-1 break-words">{formatBRL(stats.totalGeralMes)}</p>
        <div className="mt-3 flex gap-2 text-fluid-xs flex-wrap">
          <span className="bg-white/20 rounded-full px-3 py-1">
            {perfilAtivoNome}: {formatBRL(stats.totalPerfilAtivo)}
          </span>
          <span className="bg-white/20 rounded-full px-3 py-1">
            {stats.pendentes.length} pendentes
          </span>
          <span className="bg-white/20 rounded-full px-3 py-1">
            {stats.atrasadas.length} atrasadas
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 mb-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users size={14} /> Total por perfil
            </span>
            <span className="text-sm font-extrabold">{formatBRL(totaisPerfis.totalGeral)}</span>
          </div>
          {totaisPerfis.porPerfil.length === 0 && totaisPerfis.semPerfil.qtd === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma conta neste mês.
            </p>
          ) : (
          <div className="space-y-2">
            {totaisPerfis.porPerfil.map(({ perfil, total, qtd }) => (
              <div key={perfil.id} className="flex items-center justify-between gap-2 min-w-0">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="grid place-items-center size-7 rounded-full text-sm shrink-0"
                    style={{ background: `${perfil.cor}22`, color: perfil.cor }}
                  >
                    {perfil.emoji}
                  </span>
                  <span className="truncate text-sm font-medium">{perfil.nome}</span>
                  <span className="text-xs text-muted-foreground shrink-0">· {qtd}</span>
                </span>
                <span className="text-sm font-semibold shrink-0">{formatBRL(total)}</span>
              </div>
            ))}
            {totaisPerfis.semPerfil.qtd > 0 && (
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="grid place-items-center size-7 rounded-full bg-secondary text-primary text-sm shrink-0">
                    👤
                  </span>
                  <span className="truncate text-sm font-medium">{donoNome}</span>
                  <span className="text-xs text-muted-foreground shrink-0">· {totaisPerfis.semPerfil.qtd}</span>
                </span>
                <span className="text-sm font-semibold shrink-0">{formatBRL(totaisPerfis.semPerfil.total)}</span>
              </div>
            )}
          </div>
          )}
        </div>


      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link
          to="/ia"
          className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 shadow-[var(--shadow-card)]"
        >
          <span className="grid place-items-center size-11 rounded-2xl bg-secondary text-primary">
            <Sparkles size={20} />
          </span>
          <span className="text-sm font-semibold leading-tight">IA Financeira</span>
          <span className="text-xs text-muted-foreground leading-tight">Cortes, MEI, imposto</span>
        </Link>
        <Link
          to="/dashboard"
          className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 shadow-[var(--shadow-card)]"
        >
          <span className="grid place-items-center size-11 rounded-2xl bg-secondary text-primary">
            <BarChart3 size={20} />
          </span>
          <span className="text-sm font-semibold leading-tight">Dashboard</span>
          <span className="text-xs text-muted-foreground leading-tight">Gráficos e exportar</span>
        </Link>
        <Link
          to="/categorias"
          className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 shadow-[var(--shadow-card)]"
        >
          <span className="grid place-items-center size-11 rounded-2xl bg-secondary text-primary">
            <Tag size={20} />
          </span>
          <span className="text-sm font-semibold leading-tight">Categorias</span>
          <span className="text-xs text-muted-foreground leading-tight">Criar e editar</span>
        </Link>
        <Link
          to="/perfis"
          className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 shadow-[var(--shadow-card)]"
        >
          <span className="grid place-items-center size-11 rounded-2xl bg-secondary text-primary">
            <Users size={20} />
          </span>
          <span className="text-sm font-semibold leading-tight">Perfis</span>
          <span className="text-xs text-muted-foreground leading-tight">Família / parceiro(a)</span>
        </Link>
      </div>


      <button
        type="button"
        onClick={enableNotifications}
        disabled={checkingNotifications}
        className="w-full rounded-2xl bg-card border border-border p-4 mb-4 flex items-center gap-3 text-left shadow-[var(--shadow-card)] disabled:opacity-80"
      >
        <span className="grid place-items-center size-11 rounded-2xl bg-secondary text-primary shrink-0">
          {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">
            {notificationsEnabled ? "Notificações ativadas" : "Ativar notificações"}
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            {notificationsEnabled ? "Avisos são reagendados sempre que você abre o app." : "Toque para liberar avisos de contas vencendo e atrasadas."}
          </span>
        </span>
      </button>

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
