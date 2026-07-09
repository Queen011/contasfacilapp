import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, Repeat2, ScanLine, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
const mesesLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fieldClass = "w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [categoriaId, setCategoriaId] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("mensal");
  const [meses, setMeses] = useState<number[]>([]);
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || busy) return;
    if (!categoriaId) return toast.error("Escolha uma categoria.");

    const data = new FormData(event.currentTarget);
    const nome = String(data.get("nome") ?? "").trim();
    const valor = String(data.get("valor") ?? "").trim();
    const vencimento = String(data.get("vencimento") ?? "").trim();
    const observacoes = String(data.get("observacoes") ?? "").trim();

    const val = normalizarValor(valor);
    const vencimentoIso = brToIso(vencimento);
    if (!nome) return toast.error("Informe o nome da conta.");
    if (Number.isNaN(val) || val <= 0) return toast.error("Informe um valor válido.");
    if (!vencimentoIso) return toast.error("Informe o vencimento no formato dd/mm/aaaa.");
    if (recorrente && recorrencia === "personalizada" && meses.length === 0) {
      return toast.error("Selecione ao menos um mês.");
    }

    setBusy(true);
    const { error } = await supabase.from("contas").insert({
      user_id: user.id,
      nome,
      valor: val,
      vencimento: vencimentoIso,
      categoria_id: categoriaId,
      observacoes: observacoes || null,
      tipo: recorrente ? "recorrente" : "avulsa",
      recorrencia: recorrente ? recorrencia : null,
      meses_personalizados: recorrente && recorrencia === "personalizada" ? meses : null,
    });
    setBusy(false);

    if (error) return toast.error(error.message);
    toast.success("Conta criada!");
    qc.invalidateQueries({ queryKey: ["contas"] });
    navigate({ to: "/pendentes" });
  };

  const setFieldValue = (name: string, value?: string) => {
    if (!value) return;
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value;
  };

  const aplicarPreview = () => {
    if (!preview) return;
    setFieldValue("nome", preview.nome.trim());
    setFieldValue("valor", preview.valor.trim());
    setFieldValue("vencimento", preview.vencimento.trim() ? maskDateBR(preview.vencimento) : undefined);
    setPreview(null);
    toast.success("Dados aplicados. Confira e salve.");
  };

  const toggleMes = (mes: number) => {
    setMeses((atuais) =>
      atuais.includes(mes) ? atuais.filter((item) => item !== mes) : [...atuais, mes].sort((a, b) => a - b),
    );
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

      <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        <section className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] border border-border space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Nome</label>
            <input name="nome" type="text" placeholder="Ex: Cemig - Luz" enterKeyHint="next" className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Valor (R$)</label>
              <input name="valor" type="text" inputMode="decimal" placeholder="0,00" enterKeyHint="next" className={fieldClass} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Vencimento</label>
              <input name="vencimento" type="text" inputMode="numeric" defaultValue={initialVencimento} placeholder="dd/mm/aaaa" maxLength={10} enterKeyHint="next" className={fieldClass} />
            </div>
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Categoria</p>
          <div className="grid grid-cols-3 xs:grid-cols-4 gap-2.5">
            {categorias.map((cat) => {
              const active = categoriaId === cat.id;
              const emoji = emojiCat(cat);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaId(cat.id)}
                  className={`min-h-20 rounded-2xl bg-card p-2 text-center shadow-[var(--shadow-card)] border-2 transition ${active ? "border-primary bg-secondary" : "border-transparent"}`}
                >
                  <span className="mx-auto mb-1 grid size-9 place-items-center rounded-full text-lg" style={{ color: cat.cor, backgroundColor: `${cat.cor}1f` }}>
                    {emoji}
                  </span>
                  <span className="block text-[11px] font-black break-words leading-tight">{cat.nome}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] border border-border space-y-4">
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3 min-w-0">
              <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary shrink-0"><Repeat2 size={20} /></span>
              <span className="min-w-0"><span className="block text-sm font-extrabold">Conta recorrente</span><span className="block text-xs text-muted-foreground">Gera próximas parcelas automaticamente</span></span>
            </span>
            <input type="checkbox" checked={recorrente} onChange={(event) => setRecorrente(event.currentTarget.checked)} className="size-6 accent-primary shrink-0" />
          </label>

          {recorrente && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Frequência</label>
                <select value={recorrencia} onChange={(event) => setRecorrencia(event.currentTarget.value as Recorrencia)} className={fieldClass}>
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
                    {mesesLabels.map((label, index) => {
                      const mes = index + 1;
                      const active = meses.includes(mes);
                      return (
                        <button key={mes} type="button" onClick={() => toggleMes(mes)} className={`min-h-10 rounded-xl border text-xs font-bold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
                          {label}
                        </button>
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
          <textarea name="observacoes" enterKeyHint="done" className={`${fieldClass} min-h-24 resize-y`} />
        </div>

        <Button type="submit" disabled={busy} className="w-full min-h-12 rounded-2xl text-base font-extrabold">
          <Check size={18} /> {busy ? "Salvando..." : "Salvar conta"}
        </Button>
      </form>
    </div>
  );
}