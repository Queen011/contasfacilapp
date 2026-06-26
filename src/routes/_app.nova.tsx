import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Barcode, CalendarDays, Check, Repeat2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { parseCodigo } from "@/lib/boleto-parser";
import type { Recorrencia } from "@/lib/finance";
import { useCategorias } from "@/lib/queries";
import { escanearCodigo } from "@/lib/scanner";
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

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const hojeIso = () => new Date().toISOString().slice(0, 10);
const fieldClass =
  "h-12 w-full rounded-2xl border border-input bg-card px-4 text-base font-medium text-foreground shadow-[var(--shadow-card)] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70";

function normalizarValor(valor: string) {
  return Number(valor.replace(/\./g, "").replace(",", "."));
}

function NovaConta() {
  const { user } = useAuth();
  const { data: categorias = [], isLoading } = useCategorias();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const nomeRef = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);
  const vencimentoRef = useRef<HTMLInputElement>(null);
  const observacoesRef = useRef<HTMLTextAreaElement>(null);

  const [categoriaId, setCategoriaId] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("mensal");
  const [meses, setMeses] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const categoriaSelecionada = useMemo(
    () => categorias.find((categoria) => categoria.id === categoriaId),
    [categoriaId, categorias],
  );

  const onScan = async () => {
    const res = await escanearCodigo();
    if ("error" in res) return toast.error(res.error);

    const dados = parseCodigo(res.value);
    if (dados.tipo === "desconhecido") {
      toast.error("Código lido, mas não reconhecido. Mire na linha digitável, no código de barras principal ou no QR Code Pix.");
      return;
    }

    const preenchidos: string[] = [];
    if (dados.valor && valorRef.current) {
      valorRef.current.value = dados.valor.toFixed(2).replace(".", ",");
      preenchidos.push("valor");
    }
    if (dados.vencimento && vencimentoRef.current) {
      vencimentoRef.current.value = dados.vencimento;
      preenchidos.push("vencimento");
    }
    if (dados.nome && nomeRef.current && !nomeRef.current.value.trim()) {
      nomeRef.current.value = dados.nome;
      preenchidos.push("nome");
    }

    const tipoLabel = dados.tipo === "pix" ? "Pix" : "Boleto";
    if (preenchidos.length > 0) toast.success(`${tipoLabel} lido! Preenchido: ${preenchidos.join(", ")}.`);
    else toast.warning(`${tipoLabel} lido, mas sem dados úteis.`);
  };

  const toggleMes = (month: number) => {
    setMeses((current) =>
      current.includes(month)
        ? current.filter((m) => m !== month)
        : [...current, month].sort((a, b) => a - b),
    );
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || busy) return;
    if (!categoriaId) return toast.error("Escolha uma categoria.");

    const nomeTrim = nomeRef.current?.value.trim() ?? "";
    const valorTrim = valorRef.current?.value.trim() ?? "";
    const val = normalizarValor(valorTrim);
    if (!nomeTrim) return toast.error("Informe o nome da conta.");
    if (Number.isNaN(val) || val <= 0) return toast.error("Informe um valor válido.");
    if (recorrente && recorrencia === "personalizada" && meses.length === 0) {
      return toast.error("Selecione ao menos um mês.");
    }

    setBusy(true);
    const { error } = await supabase.from("contas").insert({
      user_id: user.id,
      nome: nomeTrim,
      valor: val,
      vencimento: vencimentoRef.current?.value || hojeIso(),
      categoria_id: categoriaId,
      observacoes: observacoesRef.current?.value.trim() || null,
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
          <p className="text-fluid-sm text-muted-foreground truncate">
            {categoriaSelecionada ? categoriaSelecionada.nome : "Cadastre uma conta a pagar"}
          </p>
        </div>
      </header>

      <Button
        type="button"
        onClick={onScan}
        className="w-full min-h-16 rounded-3xl justify-start gap-3 text-left shadow-[var(--shadow-elevated)]"
        style={{ background: "var(--gradient-primary)" }}
      >
        <span className="grid place-items-center size-11 rounded-2xl bg-white/20 shrink-0">
          <Barcode size={22} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">Escanear boleto ou QR Code Pix</span>
          <span className="block text-xs opacity-90">Preenche valor e vencimento automaticamente</span>
        </span>
      </Button>

      <form onSubmit={onSubmit} className="mt-5 space-y-5" noValidate>
        <section className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] space-y-4">
          <Field label="Nome" htmlFor="nome">
            <input
              ref={nomeRef}
              id="nome"
              className={fieldClass}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="Ex: Cemig - Luz"
              required
            />
          </Field>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <Field label="Valor (R$)" htmlFor="valor">
              <input
                ref={valorRef}
                id="valor"
                className={fieldClass}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="0,00"
                required
              />
            </Field>

            <Field label="Vencimento" htmlFor="vencimento">
              <div className="relative">
                <input
                  ref={vencimentoRef}
                  id="vencimento"
                  className={`${fieldClass} pr-10`}
                  type="date"
                  defaultValue={hojeIso()}
                  required
                />
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              </div>
            </Field>
          </div>
        </section>

        <section>
          <h2 className="text-fluid-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Categoria</h2>
          <div className="grid grid-cols-3 xs:grid-cols-4 gap-2.5">
            {categorias.map((categoria) => {
              const selected = categoria.id === categoriaId;
              return (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => setCategoriaId(categoria.id)}
                  aria-pressed={selected}
                  className={`min-h-20 rounded-2xl border-2 bg-card p-2 text-center shadow-[var(--shadow-card)] transition ${
                    selected ? "border-primary bg-secondary" : "border-transparent"
                  }`}
                >
                  <span
                    className="mx-auto mb-1.5 grid size-8 place-items-center rounded-full border text-xs font-extrabold"
                    style={{ color: categoria.cor, borderColor: categoria.cor }}
                  >
                    {categoria.nome.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="block text-[11px] leading-tight font-bold break-words">{categoria.nome}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] space-y-4">
          <label className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-3 min-w-0">
              <span className="grid place-items-center size-10 rounded-2xl bg-secondary text-primary shrink-0">
                <Repeat2 size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">Conta recorrente</span>
                <span className="block text-xs text-muted-foreground">Gera próximas parcelas automaticamente</span>
              </span>
            </span>
            <input
              type="checkbox"
              className="size-6 accent-primary shrink-0"
              checked={recorrente}
              onChange={(event) => setRecorrente(event.currentTarget.checked)}
            />
          </label>

          {recorrente && (
            <Field label="Frequência" htmlFor="recorrencia">
              <select
                id="recorrencia"
                className={fieldClass}
                value={recorrencia}
                onChange={(event) => setRecorrencia(event.currentTarget.value as Recorrencia)}
              >
                <option value="mensal">Mensal</option>
                <option value="bimestral">Bimestral</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual (ex: IPVA 1x)</option>
                <option value="personalizada">Personalizada (escolher meses)</option>
              </select>
            </Field>
          )}

          {recorrente && recorrencia === "personalizada" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Meses do ano</p>
              <div className="grid grid-cols-6 gap-1.5">
                {MESES.map((mes, index) => {
                  const month = index + 1;
                  const selected = meses.includes(month);
                  return (
                    <button
                      key={mes}
                      type="button"
                      onClick={() => toggleMes(month)}
                      aria-pressed={selected}
                      className={`h-9 rounded-xl border text-xs font-extrabold ${
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
                      }`}
                    >
                      {mes}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <Field label="Observações" htmlFor="observacoes">
          <Textarea
            ref={observacoesRef}
            id="observacoes"
            rows={3}
            className="min-h-24 rounded-2xl bg-card shadow-[var(--shadow-card)] text-base"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        </Field>

        <Button
          type="submit"
          disabled={busy}
          className="w-full h-13 rounded-2xl text-base font-bold shadow-[var(--shadow-elevated)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          {busy ? "Salvando..." : <><Check size={18} /> Salvar conta</>}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}