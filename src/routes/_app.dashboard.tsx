import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, PieChart as PieIcon, Download, FileText, FileSpreadsheet } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useContas, useCategorias, type Conta } from "@/lib/queries";
import { formatBRL } from "@/lib/finance";
import { MobilePanel } from "@/components/MobilePanel";
import { Button } from "@/components/ui/button";
import { isoToBR } from "@/lib/date-input";
import { exportarCSV, exportarPDF } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Contas Fácil" },
      {
        name: "description",
        content:
          "Resumo do mês com gráficos de contas pagas, pendentes e atrasadas, com filtro por categoria.",
      },
    ],
  }),
});

const STATUS_COLORS: Record<string, string> = {
  paga: "#10b981",
  pendente: "#f59e0b",
  atrasada: "#ef4444",
  quitada: "#0ea5e9",
};

function DashboardPage() {
  const { data: contas = [], isLoading } = useContas();
  const { data: categorias = [] } = useCategorias();
  const [categoriaId, setCategoriaId] = useState<string>("todas");
  const [mesOffset, setMesOffset] = useState(0); // 0 = mês atual
  const [exportOpen, setExportOpen] = useState(false);

  const { ym, label } = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + mesOffset);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { ym, label };
  }, [mesOffset]);

  const doMes = useMemo(
    () =>
      contas.filter((c) => {
        // Uma conta entra no mês se venceu no mês OU foi paga no mês
        const noMesPorVenc = c.vencimento.startsWith(ym);
        const noMesPorPago = c.pago_em ? c.pago_em.startsWith(ym) : false;
        const noMes = noMesPorVenc || noMesPorPago;
        const catOk = categoriaId === "todas" || c.categoria_id === categoriaId;
        return noMes && catOk;
      }),
    [contas, ym, categoriaId],
  );

  const totals = useMemo(() => {
    const sum = (s: string) =>
      doMes.filter((c) => c.status === s).reduce((acc, c) => acc + Number(c.valor), 0);
    const pagas = sum("paga") + sum("quitada");
    const pendentes = sum("pendente");
    const atrasadas = sum("atrasada");
    const total = pagas + pendentes + atrasadas;
    return { pagas, pendentes, atrasadas, total };
  }, [doMes]);

  const statusData = [
    { name: "Pagas", value: totals.pagas, color: STATUS_COLORS.paga },
    { name: "Pendentes", value: totals.pendentes, color: STATUS_COLORS.pendente },
    { name: "Atrasadas", value: totals.atrasadas, color: STATUS_COLORS.atrasada },
  ].filter((d) => d.value > 0);

  const porCategoria = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string; valor: number }>();
    for (const c of doMes) {
      const key = c.categoria?.id ?? "sem";
      const nome = c.categoria?.nome ?? "Sem categoria";
      const cor = c.categoria?.cor ?? "#64748b";
      const cur = map.get(key) ?? { nome, cor, valor: 0 };
      cur.valor += Number(c.valor);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [doMes]);

  return (
    <div className="pad-fluid-x pt-6 pb-4">
      <header className="flex items-center gap-2 mb-4 min-w-0">
        <Link
          to="/"
          className="grid place-items-center size-10 rounded-2xl bg-card border border-border shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-fluid-xl font-bold flex items-center gap-2">
            <PieIcon size={20} className="shrink-0" /> Dashboard
          </h1>
          <p className="text-fluid-xs text-muted-foreground capitalize truncate">{label}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExportOpen(true)}
          className="shrink-0"
          aria-label="Exportar relatório"
        >
          <Download size={16} /> Exportar
        </Button>
      </header>

      {exportOpen && (
        <ExportDialog
          onClose={() => setExportOpen(false)}
          contas={contas}
        />
      )}


      {/* Seletor de mês */}
      <div className="grid grid-cols-3 items-center mb-4 gap-2">
        <button
          onClick={() => setMesOffset((m) => m - 1)}
          className="rounded-xl bg-card border border-border px-2 py-2 text-fluid-xs font-medium min-w-0 truncate"
        >
          <span className="hidden xs:inline">← Anterior</span>
          <span className="xs:hidden">←</span>
        </button>
        <button
          onClick={() => setMesOffset(0)}
          className="rounded-xl bg-secondary text-secondary-foreground px-2 py-2 text-fluid-xs font-medium min-w-0 truncate"
        >
          Hoje
        </button>
        <button
          onClick={() => setMesOffset((m) => m + 1)}
          className="rounded-xl bg-card border border-border px-2 py-2 text-fluid-xs font-medium min-w-0 truncate"
        >
          <span className="hidden xs:inline">Próximo →</span>
          <span className="xs:hidden">→</span>
        </button>
      </div>

      {/* Filtro de categoria */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
          Filtrar por categoria
        </p>
        <div className="flex flex-wrap gap-2">
          <CategoriaChip
            label="Todas"
            color="#10b981"
            active={categoriaId === "todas"}
            onClick={() => setCategoriaId("todas")}
          />
          {categorias.map((cat) => (
            <CategoriaChip
              key={cat.id}
              label={cat.nome}
              color={cat.cor}
              active={categoriaId === cat.id}
              onClick={() => setCategoriaId(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Cartões resumo */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <ResumoCard
          icon={<CheckCircle2 size={16} />}
          label="Pagas"
          valor={totals.pagas}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <ResumoCard
          icon={<Clock size={16} />}
          label="Pendentes"
          valor={totals.pendentes}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <ResumoCard
          icon={<AlertTriangle size={16} />}
          label="Atrasadas"
          valor={totals.atrasadas}
          color="text-red-600"
          bg="bg-red-50"
        />
      </div>

      <div
        className="rounded-3xl p-5 text-white mb-5 shadow-[var(--shadow-elevated)]"
        style={{ background: "var(--gradient-primary)" }}
      >
        <p className="text-fluid-sm opacity-90">Total do mês</p>
        <p className="text-fluid-money font-extrabold mt-1 break-words">{formatBRL(totals.total)}</p>
        <p className="text-fluid-xs opacity-80 mt-1">{doMes.length} conta(s)</p>
      </div>

      {/* Gráfico pizza */}
      <section className="bg-card border border-border rounded-2xl p-4 mb-4">
        <h2 className="text-sm font-bold mb-3">Distribuição por status</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : statusData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sem contas neste mês.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Gráfico barras por categoria */}
      <section className="bg-card border border-border rounded-2xl p-4 mb-4">
        <h2 className="text-sm font-bold mb-3">Total por categoria</h2>
        {porCategoria.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sem dados para exibir.
          </p>
        ) : (
          <div style={{ height: Math.max(180, porCategoria.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={porCategoria}
                layout="vertical"
                margin={{ top: 5, right: 12, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} fontSize={10} />
                <YAxis type="category" dataKey="nome" width={70} fontSize={10} />

                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="valor" radius={[0, 8, 8, 0]}>
                  {porCategoria.map((entry, i) => (
                    <Cell key={i} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

function ResumoCard({
  icon,
  label,
  valor,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  valor: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl p-2.5 min-w-0 ${bg}`}>
      <div className={`flex items-center gap-1 text-fluid-xs font-semibold ${color} min-w-0`}>
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="text-fluid-sm font-bold tabular-nums mt-1 leading-tight truncate">{formatBRL(valor)}</p>
    </div>
  );
}

function CategoriaChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition max-w-full truncate ${
        active
          ? "text-white border-transparent"
          : "bg-card text-foreground border-border"
      }`}
      style={active ? { background: color } : undefined}
    >
      {label}
    </button>
  );
}

function ExportDialog({
  onClose,
  contas,
}: {
  onClose: () => void;
  contas: Conta[];
}) {
  const hoje = new Date();
  const [mesOffset, setMesOffset] = useState(0);
  const { inicioIso, fimIso, labelPeriodo } = useMemo(() => {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString().slice(0, 10);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).toISOString().slice(0, 10);
    const label = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { inicioIso: inicio, fimIso: fim, labelPeriodo: label };
  }, [hoje, mesOffset]);

  const filtradas = useMemo(() => {
    return contas.filter((c) => {
      const ref = (c.pago_em ? c.pago_em.slice(0, 10) : c.vencimento);
      return ref >= inicioIso && ref <= fimIso;
    }).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [contas, inicioIso, fimIso]);

  const titulo = `Contas de ${isoToBR(inicioIso)} a ${isoToBR(fimIso)}`;

  const doExport = async (fmt: "pdf" | "csv") => {
    if (filtradas.length === 0) {
      toast.warning("Sem contas no período selecionado.");
      return;
    }
    const base = `contas_${inicioIso}_${fimIso}`;
    try {
      if (fmt === "pdf") await exportarPDF(filtradas, titulo, `${base}.pdf`);
      else exportarCSV(filtradas, `${base}.csv`);
      toast.success(`Exportado: ${filtradas.length} conta(s).`);
      onClose();
    } catch (e) {
      toast.error("Falha ao gerar arquivo: " + (e instanceof Error ? e.message : "erro"));
    }
  };

  return (
    <MobilePanel
      title="Exportar relatório"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => doExport("csv")}>
            <FileSpreadsheet size={16} /> CSV
          </Button>
          <Button onClick={() => doExport("pdf")}>
            <FileText size={16} /> PDF
          </Button>
        </div>
      }
    >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Inclui contas com vencimento ou pagamento no período.
          </p>
          <div className="rounded-2xl bg-secondary p-3 text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Período</p>
            <p className="mt-1 text-base font-bold capitalize">{labelPeriodo}</p>
            <p className="mt-1 text-xs text-muted-foreground">{isoToBR(inicioIso)} até {isoToBR(fimIso)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" onClick={() => setMesOffset((m) => m - 1)}>
              ← Anterior
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMesOffset(0)}>
              Atual
            </Button>
            <Button type="button" variant="outline" onClick={() => setMesOffset((m) => m + 1)}>
              Próximo →
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {filtradas.length} conta(s) no período · Total {formatBRL(filtradas.reduce((a, c) => a + Number(c.valor), 0))}
          </p>
        </div>
    </MobilePanel>
  );
}

