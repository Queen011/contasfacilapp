import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Lock, Trash2, Calendar, FileText, Pencil, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useContas, useCategorias, type Conta } from "@/lib/queries";
import { CategoriaIcone } from "@/components/CategoriaIcone";
import { MobilePanel } from "@/components/MobilePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatBRL, formatDateFull, proximoVencimento } from "@/lib/finance";
import { brToIso, isoToBR, maskDateBR } from "@/lib/date-input";

export const Route = createFileRoute("/_app/conta/$id")({
  component: ContaDetalhe,
  head: () => ({
    meta: [
      { title: "Detalhes da conta — Contas Fácil" },
      { name: "description", content: "Veja, pague, quite ou exclua uma conta cadastrada no Contas Fácil." },
      { property: "og:title", content: "Detalhes da conta — Contas Fácil" },
      { property: "og:description", content: "Veja, pague, quite ou exclua uma conta cadastrada no Contas Fácil." },
    ],
  }),
});

function ContaDetalhe() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: contas = [], isLoading } = useContas();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const conta = contas.find((c) => c.id === id);
  const [editando, setEditando] = useState(false);

  if (isLoading) return <div className="p-6">Carregando…</div>;
  if (!conta) return <div className="p-6">Conta não encontrada.</div>;

  const refresh = () => qc.invalidateQueries({ queryKey: ["contas"] });

  const marcarPaga = async () => {
    const { error } = await supabase
      .from("contas")
      .update({ status: "paga", pago_em: new Date().toISOString() })
      .eq("id", conta.id);
    if (error) return toast.error(error.message);

    if (conta.tipo === "recorrente" && conta.recorrencia && user) {
      const prox = proximoVencimento(conta.vencimento, conta.recorrencia, conta.meses_personalizados);
      await supabase.from("contas").insert({
        user_id: user.id,
        categoria_id: conta.categoria_id,
        nome: conta.nome,
        valor: conta.valor,
        vencimento: prox,
        observacoes: conta.observacoes,
        tipo: "recorrente",
        recorrencia: conta.recorrencia,
        meses_personalizados: conta.meses_personalizados,
        conta_pai_id: conta.conta_pai_id ?? conta.id,
      });
      toast.success("Marcada como paga. Próxima parcela criada!");
    } else {
      toast.success("Marcada como paga!");
    }
    refresh();
    navigate({ to: "/pagas" });
  };

  const quitar = async () => {
    const { error } = await supabase
      .from("contas")
      .update({ status: "quitada", pago_em: new Date().toISOString() })
      .eq("id", conta.id);
    if (error) return toast.error(error.message);
    toast.success("Conta quitada!");
    refresh();
    navigate({ to: "/pagas" });
  };

  const excluir = async () => {
    if (!confirm("Excluir esta conta?")) return;
    const { error } = await supabase.from("contas").delete().eq("id", conta.id);
    if (error) return toast.error(error.message);
    toast.success("Excluída.");
    refresh();
    navigate({ to: "/" });
  };

  const cor = conta.categoria?.cor ?? "#10b981";
  const podeAgir = conta.status === "pendente" || conta.status === "atrasada";

  return (
    <div className="pad-fluid-x pt-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => history.back()}>
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditando(true)}>
            <Pencil size={18} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Excluir conta" onClick={excluir} className="text-destructive">
            <Trash2 size={20} />
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-3xl p-5 shadow-[var(--shadow-card)] text-center min-w-0">
        <div className="flex justify-center mb-3">
          <CategoriaIcone nome={conta.categoria?.nome ?? "Outros"} cor={cor} icone={conta.categoria?.icone} size={32} />
        </div>
        <p className="text-fluid-sm text-muted-foreground truncate">{conta.categoria?.nome}</p>
        <h1 className="text-fluid-xl font-bold mt-1 break-words">{conta.nome}</h1>
        <p className="text-fluid-3xl font-extrabold mt-3 tabular-nums break-words" style={{ color: cor }}>
          {formatBRL(conta.valor)}
        </p>
        <Badge className="mt-3 rounded-full" variant="outline">
          {conta.status.toUpperCase()}
        </Badge>
      </div>

      <div className="bg-card rounded-2xl p-4 mt-4 space-y-3">
        <Info icon={<Calendar size={16} />} label="Vencimento" value={formatDateFull(conta.vencimento)} />
        <Info icon={<FileText size={16} />} label="Tipo"
              value={conta.tipo === "recorrente" ? `Recorrente · ${conta.recorrencia}` : "Avulsa"} />
        {conta.pago_em && (
          <Info icon={<Check size={16} />} label="Pago em"
                value={new Date(conta.pago_em).toLocaleDateString("pt-BR")} />
        )}
        {conta.observacoes && (
          <div>
            <p className="text-fluid-xs text-muted-foreground mb-1">Observações</p>
            <p className="text-fluid-sm break-words">{conta.observacoes}</p>
          </div>
        )}
      </div>

      {podeAgir && (
        <div className="mt-5 space-y-2.5">
          <Button onClick={marcarPaga}
            className="w-full h-12 rounded-xl text-base font-semibold"
            style={{ background: "var(--gradient-primary)" }}>
            <Check size={18} /> Marcar como paga
          </Button>
          <Button onClick={quitar} variant="outline"
                  className="w-full h-12 rounded-xl text-base font-semibold">
            <Lock size={18} /> Quitar de vez (encerrar)
          </Button>
        </div>
      )}

      {editando && (
        <EditarContaDialog
          conta={conta}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); refresh(); }}
        />
      )}
    </div>
  );
}

function EditarContaDialog({
  conta,
  onClose,
  onSaved,
}: {
  conta: Conta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: categorias = [] } = useCategorias();
  const [nome, setNome] = useState(conta.nome);
  const [valor, setValor] = useState(Number(conta.valor).toFixed(2).replace(".", ","));
  const [vencimento, setVencimento] = useState(isoToBR(conta.vencimento));
  const [categoriaId, setCategoriaId] = useState(conta.categoria_id ?? "");
  const [observacoes, setObservacoes] = useState(conta.observacoes ?? "");
  const [busy, setBusy] = useState(false);

  const salvar = async () => {
    const n = nome.trim();
    const v = Number(valor.replace(/\./g, "").replace(",", "."));
    const vencimentoIso = brToIso(vencimento);
    if (!n) return toast.error("Informe o nome.");
    if (Number.isNaN(v) || v <= 0) return toast.error("Valor inválido.");
    if (!vencimentoIso) return toast.error("Informe o vencimento no formato dd/mm/aaaa.");
    setBusy(true);
    const { error } = await supabase.from("contas").update({
      nome: n,
      valor: v,
      vencimento: vencimentoIso,
      categoria_id: categoriaId || null,
      observacoes: observacoes.trim() || null,
    }).eq("id", conta.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta atualizada.");
    onSaved();
  };

  return (
    <MobilePanel
      title="Editar conta"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            <X size={16} /> Cancelar
          </Button>
          <Button onClick={salvar} disabled={busy}>
            <Check size={16} /> Salvar
          </Button>
        </div>
      }
    >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Valor</label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Vencimento</label>
              <Input value={vencimento} onChange={(e) => setVencimento(maskDateBR(e.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Categoria</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Sem categoria —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full min-h-24 rounded-md border border-input bg-background p-3 text-sm"
            />
          </div>
          {conta.tipo === "recorrente" && (
            <p className="text-xs text-muted-foreground">
              Esta é uma parcela de uma conta recorrente. A edição vale só para esta parcela.
            </p>
          )}
        </div>
    </MobilePanel>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="text-muted-foreground shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0 flex items-start justify-between gap-2 flex-wrap">
        <span className="text-fluid-sm text-muted-foreground">{label}</span>
        <span className="text-fluid-sm font-semibold break-words text-right min-w-0">{value}</span>
      </div>
    </div>
  );
}
