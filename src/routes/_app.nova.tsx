import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, Repeat2, ScanLine, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { parseCodigo } from "@/lib/boleto-parser";
import { brToIso, isoToBR, maskDateBR } from "@/lib/date-input";
import type { Recorrencia } from "@/lib/finance";
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

type NovaSubmit = {
  nome: string;
  valor: string;
  vencimento: string;
  categoriaId: string;
  observacoes: string;
  recorrente: boolean;
  recorrencia: Recorrencia;
  meses: number[];
};

type ScanPreview = {
  nome: string;
  valor: string;
  vencimento: string;
  raw: string;
  tipo: string;
  reconhecido: boolean;
};

const hojeIso = () => new Date().toISOString().slice(0, 10);
const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(() => isoToBR(hojeIso()));
  const [categoriaId, setCategoriaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("mensal");
  const [meses, setMeses] = useState<number[]>([]);
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [busy, setBusy] = useState(false);

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

  const submit = async (payload: NovaSubmit) => {
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
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit({ nome, valor, vencimento, categoriaId, observacoes, recorrente, recorrencia, meses });
  };

  const toggleMes = (month: number) => {
    setMeses((current) =>
      current.includes(month)
        ? current.filter((m) => m !== month)
        : [...current, month].sort((a, b) => a - b),
    );
  };

  const aplicarPreview = () => {
    if (!preview) return;
    if (preview.nome.trim()) setNome(preview.nome.trim());
    if (preview.valor.trim()) setValor(preview.valor.trim());
    if (preview.vencimento.trim()) setVencimento(maskDateBR(preview.vencimento));
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

      <form onSubmit={onSubmit} className="grid gap-4">
        <section className="bg-card rounded-3xl p-4 shadow-[var(--shadow-card)] grid gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Cemig - Luz" required />
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Valor (R$)</label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Vencimento</label>
              <Input value={vencimento} onChange={(e) => setVencimento(maskDateBR(e.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} required />
            </div>
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Categoria</p>
          <div className="grid grid-cols-3 xs:grid-cols-4 gap-2.5">
            {categorias.map((cat) => {
              const active = cat.id === categoriaId;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaId(cat.id)}
                  className={`min-h-20 rounded-2xl bg-card p-2 text-center shadow-[var(--shadow-card)] border-2 transition ${active ? "border-primary bg-secondary" : "border-transparent"}`}
                >
                  <span className="mx-auto mb-1.5 grid size-8 place-items-center rounded-full text-lg" style={{ color: cat.cor, background: `${cat.cor}1f` }}>{emojiCat(cat)}</span>
                  <span className="block text-[11px] leading-tight font-extrabold break-words">{cat.nome}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-card rounded-3xl p-4 shadow-[var(--shadow-card)] grid gap-4">
          <label className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary shrink-0"><Repeat2 size={18} /></span>
              <span className="min-w-0"><span className="block text-sm font-extrabold">Conta recorrente</span><span className="block text-xs text-muted-foreground">Gera próximas parcelas automaticamente</span></span>
            </span>
            <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} className="size-6 accent-primary shrink-0" />
          </label>

          {recorrente && (
            <div className="grid gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Frequência</label>
                <select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value as Recorrencia)} className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="mensal">Mensal</option>
                  <option value="bimestral">Bimestral</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual (ex: IPVA 1x)</option>
                  <option value="personalizada">Personalizada (escolher meses)</option>
                </select>
              </div>
              {recorrencia === "personalizada" && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Meses do ano</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {MESES_LABELS.map((label, index) => {
                      const month = index + 1;
                      const active = meses.includes(month);
                      return (
                        <button key={month} type="button" onClick={() => toggleMes(month)} className={`h-9 rounded-xl border text-xs font-black ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{label}</button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Observações</label>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="w-full min-h-24 rounded-md border border-input bg-background p-3 text-sm" />
        </div>

        <Button type="submit" disabled={busy} className="h-12 rounded-2xl text-base font-black" style={{ background: "var(--gradient-primary)" }}>
          <Check size={18} /> {busy ? "Salvando..." : "Salvar conta"}
        </Button>
      </form>
    </div>
  );
}