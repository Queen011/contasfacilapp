import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useCategorias } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { escanearCodigo } from "@/lib/scanner";
import { parseCodigo } from "@/lib/boleto-parser";
import type { Recorrencia } from "@/lib/finance";

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

function esc(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarValor(valor: string) {
  return Number(valor.replace(/\./g, "").replace(",", "."));
}

function NovaConta() {
  const { user } = useAuth();
  const { data: categorias = [], isLoading } = useCategorias();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !user || isLoading) return;

    let categoriaId = "";
    let recorrente = false;
    let recorrencia: Recorrencia = "mensal";
    let meses: number[] = [];
    let busy = false;

    const categoryHtml = categorias.map((c) => `
      <button type="button" class="cf-cat" data-id="${esc(c.id)}" aria-pressed="false">
        <span class="cf-cat-icon" style="color:${esc(c.cor)};border-color:${esc(c.cor)}">${esc(c.nome.slice(0, 1).toUpperCase())}</span>
        <span class="cf-cat-label">${esc(c.nome)}</span>
      </button>
    `).join("");

    host.innerHTML = `
      <style>
        .cf-native-page { padding: 24px clamp(14px, 4vw, 28px) 12px; }
        .cf-header { display:flex; align-items:center; gap:8px; margin-bottom:20px; min-width:0; }
        .cf-back { display:grid; place-items:center; width:40px; height:40px; border:0; border-radius:12px; background:transparent; color:#0f172a; font:28px/1 system-ui; }
        .cf-title { margin:0; font-size:clamp(1.2rem, 1.05rem + .85vw, 1.55rem); line-height:1.3; font-weight:800; color:#0f172a; }
        .cf-scan { width:100%; margin:0 0 20px; border:0; border-radius:22px; padding:16px; display:flex; align-items:center; gap:12px; text-align:left; color:white; background:linear-gradient(135deg, #34d399 0%, #10b981 100%); box-shadow:0 2px 12px rgba(15,118,110,.14); }
        .cf-scan-icon { display:grid; place-items:center; width:44px; height:44px; border-radius:18px; background:rgba(255,255,255,.20); flex:0 0 auto; font:24px/1 system-ui; }
        .cf-scan-title { display:block; font-size:14px; font-weight:800; }
        .cf-scan-sub { display:block; font-size:12px; opacity:.9; margin-top:2px; }
        .cf-form { display:flex; flex-direction:column; gap:20px; }
        .cf-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:12px; }
        .cf-label { display:block; margin:0 0 6px; font-size:14px; font-weight:700; color:#334155; }
        .cf-input, .cf-textarea, .cf-select { width:100%; min-height:44px; border:1px solid #d6e3de; border-radius:14px; padding:10px 12px; font:16px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#fff !important; color:#111827 !important; -webkit-text-fill-color:#111827 !important; caret-color:#111827 !important; outline:none; box-shadow:0 1px 3px rgba(15,23,42,.06); -webkit-user-select:text; user-select:text; touch-action:auto; color-scheme:only light; opacity:1 !important; }
        .cf-textarea { min-height:80px; resize:vertical; }
        .cf-input:focus, .cf-textarea:focus, .cf-select:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.18); }
        .cf-cats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:8px; }
        .cf-cat { min-width:0; min-height:76px; display:flex; flex-direction:column; align-items:center; gap:6px; padding:8px; border:2px solid transparent; border-radius:18px; background:#fff; color:#0f172a; box-shadow:0 1px 4px rgba(15,23,42,.05); }
        .cf-cat[aria-pressed="true"] { border-color:#10b981; background:#ecfdf5; }
        .cf-cat-icon { display:grid; place-items:center; width:28px; height:28px; border:1px solid; border-radius:999px; font-size:10px; font-weight:800; overflow:hidden; }
        .cf-cat-label { width:100%; overflow-wrap:anywhere; text-align:center; font-size:10px; line-height:1.15; font-weight:700; }
        .cf-card { border-radius:22px; padding:16px; background:#fff; box-shadow:0 1px 6px rgba(15,23,42,.06); display:flex; flex-direction:column; gap:16px; }
        .cf-switch-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .cf-help { margin:2px 0 0; font-size:12px; color:#64748b; }
        .cf-check { width:24px; height:24px; accent-color:#10b981; flex:0 0 auto; }
        .cf-months { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:6px; margin-top:8px; }
        .cf-month { height:36px; border:2px solid #d6e3de; border-radius:10px; background:#fff; color:#0f172a; font-size:12px; font-weight:700; }
        .cf-month[aria-pressed="true"] { border-color:#10b981; background:#10b981; color:#fff; }
        .cf-submit { width:100%; min-height:48px; border:0; border-radius:14px; background:linear-gradient(135deg, #34d399 0%, #10b981 100%); color:white; font-size:16px; font-weight:800; }
        .cf-submit:disabled { opacity:.7; }
        @media (min-width:640px) { .cf-cats { grid-template-columns:repeat(5,minmax(0,1fr)); } }
      </style>
      <div class="cf-native-page">
        <div class="cf-header">
          <button type="button" class="cf-back" data-action="back" aria-label="Voltar">←</button>
          <h1 class="cf-title">Nova conta</h1>
        </div>

        <button type="button" class="cf-scan" data-action="scan">
          <span class="cf-scan-icon">⌗</span>
          <span><span class="cf-scan-title">Escanear boleto ou QR Code Pix</span><span class="cf-scan-sub">Preenche valor e vencimento automaticamente</span></span>
        </button>

        <form class="cf-form" novalidate>
          <div>
            <label class="cf-label" for="nome">Nome</label>
            <input id="nome" class="cf-input" type="search" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" required placeholder="Ex: Cemig - Luz">
          </div>

          <div class="cf-row">
            <div>
              <label class="cf-label" for="valor">Valor (R$)</label>
              <input id="valor" class="cf-input" type="search" inputmode="decimal" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" required placeholder="0,00">
            </div>
            <div>
              <label class="cf-label" for="vencimento">Vencimento</label>
              <input id="vencimento" class="cf-input" type="date" value="${hojeIso()}" required>
            </div>
          </div>

          <div>
            <label class="cf-label">Categoria</label>
            <div class="cf-cats">${categoryHtml}</div>
          </div>

          <div class="cf-card">
            <div class="cf-switch-row">
              <div>
                <label class="cf-label" for="recorrente">Conta recorrente</label>
                <p class="cf-help">Gera próximas parcelas automaticamente</p>
              </div>
              <input id="recorrente" class="cf-check" type="checkbox">
            </div>

            <div data-recorrente-area hidden>
              <label class="cf-label" for="recorrencia">Frequência</label>
              <select id="recorrencia" class="cf-select">
                <option value="mensal">Mensal</option>
                <option value="bimestral">Bimestral</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual (ex: IPVA 1x)</option>
                <option value="personalizada">Personalizada (escolher meses)</option>
              </select>
            </div>

            <div data-meses-area hidden>
              <label class="cf-label">Meses do ano</label>
              <div class="cf-months">
                ${MESES.map((m, i) => `<button type="button" class="cf-month" data-month="${i + 1}" aria-pressed="false">${m}</button>`).join("")}
              </div>
            </div>
          </div>

          <div>
            <label class="cf-label" for="observacoes">Observações</label>
            <textarea id="observacoes" class="cf-textarea" rows="2" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></textarea>
          </div>

          <button type="submit" class="cf-submit">Salvar conta</button>
        </form>
      </div>
    `;

    const backButton = host.querySelector<HTMLButtonElement>('[data-action="back"]');
    const scanButton = host.querySelector<HTMLButtonElement>('[data-action="scan"]');
    const form = host.querySelector<HTMLFormElement>("form");
    const nome = host.querySelector<HTMLInputElement>("#nome");
    const valor = host.querySelector<HTMLInputElement>("#valor");
    const vencimento = host.querySelector<HTMLInputElement>("#vencimento");
    const observacoes = host.querySelector<HTMLTextAreaElement>("#observacoes");
    const recorrenteInput = host.querySelector<HTMLInputElement>("#recorrente");
    const recorrenciaSelect = host.querySelector<HTMLSelectElement>("#recorrencia");
    const recorrenteArea = host.querySelector<HTMLElement>("[data-recorrente-area]");
    const mesesArea = host.querySelector<HTMLElement>("[data-meses-area]");
    const submitButton = host.querySelector<HTMLButtonElement>(".cf-submit");

    const updateCategorias = () => {
      host.querySelectorAll<HTMLButtonElement>(".cf-cat").forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.id === categoriaId ? "true" : "false");
      });
    };

    const updateRecorrente = () => {
      recorrente = Boolean(recorrenteInput?.checked);
      if (recorrenteArea) recorrenteArea.hidden = !recorrente;
      if (mesesArea) mesesArea.hidden = !(recorrente && recorrencia === "personalizada");
    };

    const updateMeses = () => {
      host.querySelectorAll<HTMLButtonElement>(".cf-month").forEach((button) => {
        const month = Number(button.dataset.month);
        button.setAttribute("aria-pressed", meses.includes(month) ? "true" : "false");
      });
    };

    const onBack = () => navigate({ to: "/" });
    const onScan = async () => {
      const res = await escanearCodigo();
      if ("error" in res) return toast.error(res.error);

      const dados = parseCodigo(res.value);
      if (dados.tipo === "desconhecido") {
        toast.error("Código lido, mas não reconhecido como boleto ou Pix.");
        return;
      }

      const preenchidos: string[] = [];
      if (dados.valor && valor) {
        valor.value = dados.valor.toFixed(2).replace(".", ",");
        preenchidos.push("valor");
      }
      if (dados.vencimento && vencimento) {
        vencimento.value = dados.vencimento;
        preenchidos.push("vencimento");
      }
      if (dados.nome && nome && !nome.value.trim()) {
        nome.value = dados.nome;
        preenchidos.push("nome");
      }

      const tipoLabel = dados.tipo === "pix" ? "Pix" : "Boleto";
      if (preenchidos.length > 0) toast.success(`${tipoLabel} lido! Preenchido: ${preenchidos.join(", ")}.`);
      else toast.warning(`${tipoLabel} lido, mas sem dados úteis.`);
    };

    const onCategoryClick = (event: Event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(".cf-cat");
      if (!target) return;
      categoriaId = target.dataset.id || "";
      updateCategorias();
    };

    const onRecorrenteChange = () => updateRecorrente();
    const onRecorrenciaChange = () => {
      recorrencia = (recorrenciaSelect?.value || "mensal") as Recorrencia;
      updateRecorrente();
    };
    const onMonthClick = (event: Event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(".cf-month");
      if (!target) return;
      const month = Number(target.dataset.month);
      meses = meses.includes(month) ? meses.filter((m) => m !== month) : [...meses, month].sort((a, b) => a - b);
      updateMeses();
    };

    const onSubmit = async (event: Event) => {
      event.preventDefault();
      if (busy) return;
      if (!categoriaId) return toast.error("Escolha uma categoria.");

      const nomeTrim = nome?.value.trim() ?? "";
      const valorTrim = valor?.value.trim() ?? "";
      const val = normalizarValor(valorTrim);
      if (!nomeTrim) return toast.error("Informe o nome da conta.");
      if (Number.isNaN(val) || val <= 0) return toast.error("Informe um valor válido.");
      if (recorrente && recorrencia === "personalizada" && meses.length === 0) {
        return toast.error("Selecione ao menos um mês.");
      }

      busy = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Salvando...";
      }

      const { error } = await supabase.from("contas").insert({
        user_id: user.id,
        nome: nomeTrim,
        valor: val,
        vencimento: vencimento?.value || hojeIso(),
        categoria_id: categoriaId,
        observacoes: observacoes?.value.trim() || null,
        tipo: recorrente ? "recorrente" : "avulsa",
        recorrencia: recorrente ? recorrencia : null,
        meses_personalizados: recorrente && recorrencia === "personalizada" ? meses : null,
      });

      busy = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Salvar conta";
      }

      if (error) return toast.error(error.message);
      toast.success("Conta criada!");
      qc.invalidateQueries({ queryKey: ["contas"] });
      navigate({ to: "/pendentes" });
    };

    backButton?.addEventListener("click", onBack);
    scanButton?.addEventListener("click", onScan);
    host.addEventListener("click", onCategoryClick);
    host.addEventListener("click", onMonthClick);
    recorrenteInput?.addEventListener("change", onRecorrenteChange);
    recorrenciaSelect?.addEventListener("change", onRecorrenciaChange);
    form?.addEventListener("submit", onSubmit);

    return () => {
      backButton?.removeEventListener("click", onBack);
      scanButton?.removeEventListener("click", onScan);
      host.removeEventListener("click", onCategoryClick);
      host.removeEventListener("click", onMonthClick);
      recorrenteInput?.removeEventListener("change", onRecorrenteChange);
      recorrenciaSelect?.removeEventListener("change", onRecorrenciaChange);
      form?.removeEventListener("submit", onSubmit);
      host.innerHTML = "";
    };
  }, [categorias, isLoading, navigate, qc, user]);

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

  return <div ref={hostRef} aria-label="Formulário nativo de nova conta" />;
}
