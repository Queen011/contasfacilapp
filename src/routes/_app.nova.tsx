import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { ArrowLeft, ScanLine } from "lucide-react";
import { useCategorias } from "@/lib/queries";
import { CategoriaIcone } from "@/components/CategoriaIcone";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Recorrencia } from "@/lib/finance";
import { escanearCodigo } from "@/lib/scanner";
import { parseCodigo } from "@/lib/boleto-parser";

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

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const hojeIso = () => new Date().toISOString().slice(0, 10);
const nativeInputClass = "mt-1.5 block min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-base text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const nativeTextareaClass = "mt-1.5 block min-h-20 w-full rounded-xl border border-input bg-card px-3 py-2 text-base text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const textInputProps = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
} as const;

function setFieldValue<T extends HTMLInputElement | HTMLTextAreaElement>(
  ref: RefObject<T | null>,
  value: string,
) {
  if (ref.current) ref.current.value = value;
}

function NovaConta() {
  const { user } = useAuth();
  const { data: categorias = [] } = useCategorias();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const nomeRef = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);
  const vencimentoRef = useRef<HTMLInputElement>(null);
  const observacoesRef = useRef<HTMLTextAreaElement>(null);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [recorrente, setRecorrente] = useState(false);
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("mensal");
  const [meses, setMeses] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleMes = (m: number) =>
    setMeses((arr) => arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m].sort((a,b)=>a-b));

  const onScan = async () => {
    const res = await escanearCodigo();
    if ("error" in res) return toast.error(res.error);

    const dados = parseCodigo(res.value);
    if (dados.tipo === "desconhecido") {
      return toast.error("Código lido, mas não reconhecido como boleto ou Pix.");
    }

    let preenchidos: string[] = [];
    if (dados.valor) {
      setFieldValue(valorRef, dados.valor.toFixed(2).replace(".", ","));
      preenchidos.push("valor");
    }
    if (dados.vencimento) {
      setFieldValue(vencimentoRef, dados.vencimento);
      preenchidos.push("vencimento");
    }
    if (dados.nome && !nomeRef.current?.value.trim()) {
      setFieldValue(nomeRef, dados.nome);
      preenchidos.push("nome");
    }

    const tipoLabel = dados.tipo === "pix" ? "Pix" : "Boleto";
    if (preenchidos.length > 0) {
      toast.success(`${tipoLabel} lido! Preenchido: ${preenchidos.join(", ")}.`);
    } else {
      toast.warning(`${tipoLabel} lido, mas sem dados úteis.`);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!categoriaId) return toast.error("Escolha uma categoria.");
    const nomeTrim = nomeRef.current?.value.trim() ?? "";
    const valorTrim = valorRef.current?.value.trim() ?? "";
    const vencimentoValue = vencimentoRef.current?.value || hojeIso();
    const observacoesTrim = observacoesRef.current?.value.trim() ?? "";
    if (!nomeTrim) return toast.error("Informe o nome da conta.");
    const val = Number(valorTrim.replace(",", "."));
    if (isNaN(val) || val <= 0) return toast.error("Informe um valor válido.");
    if (recorrente && recorrencia === "personalizada" && meses.length === 0)
      return toast.error("Selecione ao menos um mês.");

    setBusy(true);
    const { error } = await supabase.from("contas").insert({
      user_id: user.id,
      nome: nomeTrim,
      valor: val,
      vencimento: vencimentoValue,
      categoria_id: categoriaId,
      observacoes: observacoesTrim || null,
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

  return (
    <div className="pad-fluid-x pt-6">
      <div className="flex items-center gap-2 mb-5 min-w-0">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate({ to: "/" })} className="shrink-0">
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <h1 className="text-fluid-xl font-bold truncate">Nova conta</h1>
        </div>
      </div>

      <button
        type="button"
        onClick={onScan}
        className="w-full mb-5 rounded-2xl p-4 flex items-center gap-3 text-left shadow-[var(--shadow-card)] text-white"
        style={{ background: "var(--gradient-primary)" }}
      >
        <span className="grid place-items-center size-11 rounded-2xl bg-white/20 shrink-0">
          <ScanLine size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">Escanear boleto ou QR Code Pix</span>
          <span className="block text-xs opacity-90 mt-0.5">Preenche valor e vencimento automaticamente</span>
        </span>
      </button>

      <form onSubmit={onSubmit} className="space-y-5">

        <div>
          <Label htmlFor="nome">Nome</Label>
          <input
            id="nome"
            ref={nomeRef}
            type="text"
            inputMode="text"
            enterKeyHint="next"
            required
            {...textInputProps}
            placeholder="Ex: Cemig - Luz"
            className={nativeInputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <input
              id="valor"
              ref={valorRef}
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              required
              {...textInputProps}
              placeholder="0,00"
              className={nativeInputClass}
            />
          </div>
          <div>
            <Label htmlFor="vencimento">Vencimento</Label>
            <input
              id="vencimento"
              ref={vencimentoRef}
              type="date"
              defaultValue={hojeIso()}
              required
              className={nativeInputClass}
            />
          </div>
        </div>

        <div>
          <Label>Categoria</Label>
          <div className="mt-2 grid grid-cols-4 sm:grid-cols-5 gap-2">
            {categorias.map((c) => {
              const active = c.id === categoriaId;
              return (
                <button
                  type="button" key={c.id}
                  onClick={() => setCategoriaId(c.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition min-w-0 ${
                    active ? "border-primary bg-primary/5" : "border-transparent bg-card"
                  }`}
                >
                  <CategoriaIcone nome={c.icone} cor={c.cor} size={18} />
                  <span className="text-[10px] font-medium leading-tight text-center break-words w-full">{c.nome}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="recorrente" className="text-base">Conta recorrente</Label>
              <p className="text-xs text-muted-foreground">Gera próximas parcelas automaticamente</p>
            </div>
            <input
              id="recorrente"
              type="checkbox"
              checked={recorrente}
              onChange={(event) => setRecorrente(event.currentTarget.checked)}
              className="h-6 w-6 shrink-0 accent-primary"
            />
          </div>

          {recorrente && (
            <>
              <div>
                <Label htmlFor="recorrencia">Frequência</Label>
                <select
                  id="recorrencia"
                  value={recorrencia}
                  onChange={(event) => setRecorrencia(event.currentTarget.value as Recorrencia)}
                  className={nativeInputClass}
                >
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
                  <Label>Meses do ano</Label>
                  <div className="mt-2 grid grid-cols-6 gap-1.5">
                    {MESES.map((m, i) => {
                      const num = i + 1;
                      const on = meses.includes(num);
                      return (
                        <button type="button" key={num} onClick={() => toggleMes(num)}
                          className={`h-9 rounded-lg text-xs font-medium border-2 ${
                            on ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"
                          }`}>
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <Label htmlFor="observacoes">Observações</Label>
          <textarea
            id="observacoes"
            ref={observacoesRef}
            rows={2}
            enterKeyHint="done"
            {...textInputProps}
            className={nativeTextareaClass}
          />
        </div>

        <Button type="submit" disabled={busy}
                className="w-full h-12 rounded-xl text-base font-semibold"
                style={{ background: "var(--gradient-primary)" }}>
          {busy ? "Salvando..." : "Salvar conta"}
        </Button>
      </form>
    </div>
  );
}
