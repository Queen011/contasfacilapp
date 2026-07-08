import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, Repeat2, ScanLine, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NativeNovaFormFrame, type NovaApplyData, type NovaSubmit } from "@/components/NativeNovaFormFrame";
import { useAuth } from "@/lib/auth";
import { parseCodigo } from "@/lib/boleto-parser";
import { brToIso, isoToBR, maskDateBR } from "@/lib/date-input";
import { useCategorias, type Categoria } from "@/lib/queries";
import { escanearCodigo, escanearFotoBoleto } from "@/lib/scanner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/nova")({
  component: NovaConta,
  head: () => ({
    meta: [
      { title: "Nova Conta — Cadastrar despesa | Contas Fácil" },
      { name: "description", content: "Cadastre uma nova conta avulsa ou recorrente, com categoria, valor e data de vencimento." },
      { property: "og:title", content: "Nova Conta — Cadastrar despesa | Contas Fácil" },
      { property: "og:description", content: "Cadastre uma nova conta avulsa ou recorrente, com categoria, valor e data de vencimento." },
    ],
  }),
});

type ScanPreview = {
  nome: string;
  valor: string;
  vencimento: string;
  raw: string;
  tipo: string;
  reconhecido: boolean;
};

const hojeIso = () => new Date().toISOString().slice(0, 10);
const EMOJIS: Record<string, string> = {
  luz: "💡", internet: "📶", agua: "💧", água: "💧", gas: "🔥", gás: "🔥",
  cartao: "💳", cartão: "💳", boleto: "🧾", ipva: "🚗", carro: "🚗", mei: "📄",
  aluguel: "🏠", casa: "🏠", streaming: "📺", tv: "📺", mercado: "🛒", comida: "🍔",
  saude: "💊", saúde: "💊", educacao: "🎓", educação: "🎓", outros: "🏷️",
};
const emojiRegex = /\p{Extended_Pictographic}/u;

function normalizarValor(valor: string) {
  return Number(valor.replace(/\./g, "").replace(",", "."));
}

function emojiCat(cat: Categoria) {
  if (cat.icone && emojiRegex.test(cat.icone)) return cat.icone;
  return EMOJIS[cat.nome.trim().toLowerCase()] || "🏷️";
}

function NovaConta() {
  const { user } = useAuth();
  const { data: categorias = [], isLoading } = useCategorias();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [applyData, setApplyData] = useState<NovaApplyData>(null);
  const [busy, setBusy] = useState(false);
  const initialVencimento = useMemo(() => isoToBR(hojeIso()), []);

  const handleScan = async (modo: "scanner" | "foto") => {
    const res = modo === "foto" ? await escanearFotoBoleto() : await escanearCodigo();
    if ("error" in res) return toast.error(res.error);

    const dados = parseCodigo(res.value);
    const tipo = dados.tipo === "pix" ? "Pix"
      : dados.tipo === "boleto-arrecadacao" ? "Boleto (concessionária)"
      : dados.tipo === "boleto-bancario" ? "Boleto bancário"
      : "Código";

    setPreview({
      nome: dados.nome || "",
      valor: dados.valor ? dados.valor.toFixed(2).replace(".", ",") : "",
      vencimento: dados.vencimento ? isoToBR(dados.vencimento) : "",
      raw: res.value,
      tipo,
      reconhecido: dados.tipo !== "desconhecido",
    });
    if (dados.tipo === "desconhecido") {
      toast.warning("Código lido, mas não reconhecido. Confira e edite na prévia.");
    }
  };

  const submit = useCallback(async (payload: NovaSubmit) => {
    if (!user || busy) return;
    if (!payload.categoriaId) return toast.error("Escolha uma categoria.");

    const nome = payload.nome.trim();
    const val = normalizarValor(payload.valor.trim());
    const vencimentoIso = brToIso(payload.vencimento);
    if (!nome) return toast.error("Informe o nome da conta.");
    if (Number.isNaN(val) || val <= 0) return toast.error("Informe um valor válido.");
    if (!vencimentoIso) return toast.error("Informe o vencimento no formato dd/mm/aaaa.");
    if (payload.recorrente && payload.recorrencia === "personalizada" && payload.meses.length === 0) {
      return toast.error("Selecione ao menos um mês.");
    }

    setBusy(true);
    const { error } = await supabase.from("contas").insert({
      user_id: user.id,
      nome,
      valor: val,
      vencimento: vencimentoIso,
      categoria_id: payload.categoriaId,
      observacoes: payload.observacoes.trim() || null,
      tipo: payload.recorrente ? "recorrente" : "avulsa",
      recorrencia: payload.recorrente ? payload.recorrencia : null,
      meses_personalizados: payload.recorrente && payload.recorrencia === "personalizada" ? payload.meses : null,
    });
    setBusy(false);

    if (error) return toast.error(error.message);
    toast.success("Conta criada!");
    qc.invalidateQueries({ queryKey: ["contas"] });
    navigate({ to: "/pendentes" });
  }, [busy, navigate, qc, user]);

  const aplicarPreview = () => {
    if (!preview) return;
    setApplyData({
      nome: preview.nome.trim() || undefined,
      valor: preview.valor.trim() || undefined,
      vencimento: preview.vencimento.trim() ? maskDateBR(preview.vencimento) : undefined,
    });
    setPreview(null);
    toast.success("Dados aplicados. Confira e salve.");
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="size-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  if (categorias.length === 0) {
    return (
      <div className="pad-fluid-x pt-6">
        <button type="button" onClick={() => navigate({ to: "/" })} className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl">
          <ArrowLeft />
        </button>
        <h1 className="text-fluid-xl font-bold">Nova conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
      </div>
    );
  }

  return (
    <div className="pad-fluid-x pt-6 pb-10">
      <header className="flex items-center gap-3 mb-5 min-w-0">
        <Button type="button" variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft size={20} />
        </Button>
        <div className="min-w-0">
          <h1 className="text-fluid-2xl font-bold truncate">Nova conta</h1>
          <p className="text-fluid-sm text-muted-foreground truncate">Cadastre uma conta a pagar</p>
        </div>
      </header>

      <div className="grid gap-3 mb-4">
        <button
          type="button"
          onClick={() => handleScan("scanner")}
          className="w-full min-h-16 rounded-3xl px-4 py-3 text-left text-primary-foreground flex items-center gap-3 shadow-[var(--shadow-elevated)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-foreground/20 shrink-0"><ScanLine size={22} /></span>
          <span className="min-w-0"><span className="block text-sm font-extrabold">Escanear (QR Code Pix)</span><span className="block text-xs opacity-90">Use a câmera com leitor</span></span>
        </button>
        <button
          type="button"
          onClick={() => handleScan("foto")}
          className="w-full min-h-16 rounded-3xl bg-primary px-4 py-3 text-left text-primary-foreground flex items-center gap-3 shadow-[var(--shadow-elevated)]"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-foreground/20 shrink-0"><Camera size={22} /></span>
          <span className="min-w-0"><span className="block text-sm font-extrabold">Foto do boleto</span><span className="block text-xs opacity-90">Tire foto do código de barras inteiro</span></span>
        </button>
      </div>

      {preview && (
        <section className="mb-4 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] border border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold">Prévia da leitura</p>
              <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black uppercase ${preview.reconhecido ? "bg-secondary text-primary" : "bg-amber-100 text-amber-800"}`}>
                {preview.reconhecido ? preview.tipo : "Não reconhecido"}
              </span>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar prévia" onClick={() => setPreview(null)}>
              <X size={18} />
            </Button>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {preview.nome && <p><span className="text-muted-foreground">Nome:</span> <strong>{preview.nome}</strong></p>}
            {preview.valor && <p><span className="text-muted-foreground">Valor:</span> <strong>R$ {preview.valor}</strong></p>}
            {preview.vencimento && <p><span className="text-muted-foreground">Vencimento:</span> <strong>{preview.vencimento}</strong></p>}
            <p className="max-h-16 overflow-auto rounded-xl bg-muted p-2 font-mono text-[11px] text-muted-foreground break-all">{preview.raw}</p>
          </div>
          <Button type="button" onClick={aplicarPreview} className="mt-3 w-full">
            Aplicar ao formulário
          </Button>
        </section>
      )}

      <NativeNovaFormFrame
        categorias={categorias}
        initialVencimento={initialVencimento}
        applyData={applyData}
        busy={busy}
        onSubmit={submit}
      />
    </div>
  );
}