import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { parseCodigo } from "@/lib/boleto-parser";
import type { Recorrencia } from "@/lib/finance";
import { useCategorias, type Categoria } from "@/lib/queries";
import { escanearCodigo, escanearFotoBoleto } from "@/lib/scanner";
import { supabase } from "@/integrations/supabase/client";
import { useActivePerfilId, usePerfis } from "@/lib/perfis";
import { useProfile } from "@/lib/profile";

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

type FrameSubmit = {
  nome: string;
  valor: string;
  vencimento: string;
  categoriaId: string;
  observacoes: string;
  recorrente: boolean;
  recorrencia: Recorrencia;
  meses: number[];
};

type ScanMode = "scanner" | "foto";

type NovaFrameMessage =
  | { source: "contasfacil-nova-frame"; type: "submit"; payload: FrameSubmit }
  | { source: "contasfacil-nova-frame"; type: "scan"; mode: ScanMode }
  | { source: "contasfacil-nova-frame"; type: "height"; height: number };

const hojeIso = () => new Date().toISOString().slice(0, 10);

function normalizarValor(valor: string) {
  return Number(valor.replace(/\./g, "").replace(",", "."));
}

function postToFrame(iframe: HTMLIFrameElement | null, message: Record<string, unknown>) {
  iframe?.contentWindow?.postMessage({ source: "contasfacil-nova-parent", ...message }, "*");
}

function NovaConta() {
  const { user } = useAuth();
  const { data: categorias = [], isLoading } = useCategorias();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(1040);
  const [busy, setBusy] = useState(false);
  const [activePerfilId] = useActivePerfilId();
  const { data: perfis = [] } = usePerfis();
  const { data: profile } = useProfile(user?.id);
  const donoNome = profile?.nome?.trim() || user?.email?.split("@")[0] || "Você";
  const perfilAtivo = perfis.find((p) => p.id === activePerfilId);
  const perfilLabel = perfilAtivo ? `${perfilAtivo.emoji} ${perfilAtivo.nome}` : `👤 ${donoNome}`;

  const frameHtml = useMemo(() => buildNovaFrameHtml(categorias), [categorias]);

  const setFrameBusy = (value: boolean) => {
    setBusy(value);
    postToFrame(iframeRef.current, { type: "busy", busy: value });
  };

  const handleScan = async (modo: ScanMode) => {
    const res = modo === "foto" ? await escanearFotoBoleto() : await escanearCodigo();
    if ("error" in res) return toast.error(res.error);

    const dados = parseCodigo(res.value);
    const tipo = dados.tipo === "pix" ? "Pix"
      : dados.tipo === "boleto-arrecadacao" ? "Boleto (concessionária)"
      : dados.tipo === "boleto-bancario" ? "Boleto bancário"
      : "Código";

    postToFrame(iframeRef.current, {
      type: "scanResult",
      payload: {
        nome: dados.nome || "",
        valor: dados.valor ? dados.valor.toFixed(2).replace(".", ",") : "",
        vencimento: dados.vencimento || "",
        tipo,
      },
    });

    const semDados = !dados.valor && !dados.vencimento && !dados.nome;
    if (dados.tipo === "desconhecido" || semDados) {
      toast.warning(`${tipo} lido, mas sem dados completos. Confira e preencha manualmente.`);
    } else {
      toast.success(`${tipo} lido. Confira os campos preenchidos.`);
    }
  };

  const submit = async (payload: FrameSubmit) => {
    if (!user || busy) return;
    if (!payload.categoriaId) return toast.error("Escolha uma categoria.");

    const nome = payload.nome.trim();
    const val = normalizarValor(payload.valor.trim());
    if (!nome) return toast.error("Informe o nome da conta.");
    if (Number.isNaN(val) || val <= 0) return toast.error("Informe um valor válido.");
    if (payload.recorrente && payload.recorrencia === "personalizada" && payload.meses.length === 0) {
      return toast.error("Selecione ao menos um mês.");
    }

    // Lê o perfil ativo direto do storage no momento do submit para evitar
    // salvar em "sem perfil" quando o usuário acabou de trocar de perfil.
    const perfilNoSubmit = typeof window !== "undefined"
      ? window.localStorage.getItem("contasfacil.perfil_ativo") || activePerfilId
      : activePerfilId;

    setFrameBusy(true);
    const { error } = await supabase.from("contas").insert({
      user_id: user.id,
      nome,
      valor: val,
      vencimento: payload.vencimento || hojeIso(),
      categoria_id: payload.categoriaId,
      observacoes: payload.observacoes.trim() || null,
      tipo: payload.recorrente ? "recorrente" : "avulsa",
      recorrencia: payload.recorrente ? payload.recorrencia : null,
      meses_personalizados: payload.recorrente && payload.recorrencia === "personalizada" ? payload.meses : null,
      perfil_id: perfilNoSubmit,
    });
    setFrameBusy(false);

    if (error) return toast.error(error.message);
    toast.success("Conta criada!");
    qc.invalidateQueries({ queryKey: ["contas"] });
    navigate({ to: "/pendentes" });
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent<NovaFrameMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "contasfacil-nova-frame") return;
      if (data.type === "height") setIframeHeight(Math.max(880, Math.min(2200, data.height)));
      if (data.type === "scan") handleScan(data.mode);
      if (data.type === "submit") submit(data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [busy, categorias]);

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
        <div className="min-w-0 flex-1">
          <h1 className="text-fluid-2xl font-bold truncate">Nova conta</h1>
          <p className="text-fluid-sm text-muted-foreground truncate">
            Salvando no perfil: <span className="font-semibold text-foreground">{perfilLabel}</span>
          </p>
        </div>
      </header>

      <iframe
        ref={iframeRef}
        title="Formulário de nova conta"
        srcDoc={frameHtml}
        className="block w-full rounded-3xl bg-transparent"
        style={{ height: iframeHeight, border: 0 }}
        sandbox="allow-scripts allow-forms allow-same-origin"
        aria-busy={busy}
      />
    </div>
  );
}

function buildNovaFrameHtml(categorias: Categoria[]) {
  const categoriasJson = JSON.stringify(categorias).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <style>
    :root { color-scheme: only light; --card:#ffffff; --text:#123033; --muted:#667a7b; --border:#dbecea; --primary:#12b981; --primary-dark:#059669; --secondary:#e8f8f3; --shadow-card:0 2px 12px -2px rgba(10,120,100,.14); --shadow-elevated:0 8px 32px -8px rgba(10,120,100,.28); font-family:"Plus Jakarta Sans",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent} html,body{margin:0;min-height:100%;background:transparent;color:var(--text)} body{overflow:hidden;font-family:inherit} button,input,textarea,select{font:inherit;font-size:16px} button{border:0;cursor:pointer;touch-action:manipulation}
    input,textarea,select{appearance:auto;-webkit-appearance:auto;width:100%;min-height:48px;border:1px solid var(--border);border-radius:18px;background:#fff!important;color:#111827!important;-webkit-text-fill-color:#111827!important;caret-color:#111827!important;padding:0 16px;outline:none;line-height:normal;opacity:1!important;user-select:text;-webkit-user-select:text;box-shadow:var(--shadow-card)}
    textarea{min-height:96px;padding-block:12px;resize:none} input:focus,textarea:focus,select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(18,185,129,.18),var(--shadow-card)} input::placeholder,textarea::placeholder{color:#6b7280;-webkit-text-fill-color:#6b7280;opacity:1}
    .stack{display:grid;gap:18px}.card{background:var(--card);border-radius:28px;padding:16px;box-shadow:var(--shadow-card);display:grid;gap:16px}.field{display:grid;gap:8px;min-width:0}label,.label{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.scanGrid{display:grid;gap:10px}.scan{width:100%;min-height:64px;border-radius:28px;padding:10px 14px;color:#fff;display:flex;gap:12px;align-items:center;text-align:left;background:linear-gradient(135deg,#2dd4bf 0%,#10b981 100%);box-shadow:var(--shadow-elevated)}.scan.alt{background:#12b981}.scanIcon{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:rgba(255,255,255,.2);flex:none}.scanTitle{display:block;font-size:14px;font-weight:800}.scanSub{display:block;font-size:12px;opacity:.9;margin-top:2px}.grid2{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:360px){.grid2{grid-template-columns:1fr 1fr}.catGrid{grid-template-columns:repeat(4,minmax(0,1fr))}}.catGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.cat{min-height:80px;border-radius:18px;background:var(--card);padding:8px 6px;text-align:center;border:2px solid transparent;box-shadow:var(--shadow-card);color:var(--text)}.cat.active{border-color:var(--primary);background:var(--secondary)}.catDot{margin:0 auto 6px;width:36px;height:36px;border-radius:999px;display:grid;place-items:center;font-size:20px}.catName{display:block;font-size:11px;line-height:1.1;font-weight:800;overflow-wrap:anywhere}.switchRow{display:flex;align-items:center;justify-content:space-between;gap:14px}.switchText{min-width:0;display:flex;gap:12px;align-items:center}.switchIcon{width:40px;height:40px;border-radius:16px;background:var(--secondary);color:var(--primary);display:grid;place-items:center;flex:none}.switchTitle{display:block;font-size:14px;font-weight:800}.switchSub{display:block;font-size:12px;color:var(--muted);margin-top:2px}input[type="checkbox"]{width:24px;min-height:24px;height:24px;accent-color:var(--primary);box-shadow:none;flex:none}.months{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.month{height:36px;border-radius:12px;border:1px solid var(--border);background:#fff;color:var(--text);font-size:12px;font-weight:900}.month.active{background:var(--primary);color:#fff;border-color:var(--primary)}.save{width:100%;height:52px;border-radius:18px;color:#fff;font-size:16px;font-weight:900;background:linear-gradient(135deg,#2dd4bf 0%,#10b981 100%);box-shadow:var(--shadow-elevated)}.save:disabled{opacity:.7}.notice{display:none;border-radius:18px;padding:12px;font-size:13px;font-weight:700;background:var(--secondary);color:var(--primary-dark)}.notice.show{display:block}
  </style>
</head>
<body>
  <main class="stack">
    <div class="scanGrid">
      <button id="scanBtn" type="button" class="scan"><span class="scanIcon" aria-hidden="true">▦</span><span><span class="scanTitle">Escanear (QR Code Pix)</span><span class="scanSub">Use a câmera com leitor</span></span></button>
      <button id="photoBtn" type="button" class="scan alt"><span class="scanIcon" aria-hidden="true">▤</span><span><span class="scanTitle">Foto do boleto</span><span class="scanSub">Tire foto do código de barras inteiro</span></span></button>
    </div>
    <div id="notice" class="notice"></div>
    <form id="form" class="stack" novalidate>
      <section class="card"><div class="field"><label for="nome">Nome</label><input id="nome" name="nome" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" placeholder="Ex: Cemig - Luz" required /></div><div class="grid2"><div class="field"><label for="valor">Valor (R$)</label><input id="valor" name="valor" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" placeholder="0,00" required /></div><div class="field"><label for="vencimento">Vencimento</label><input id="vencimento" name="vencimento" type="date" value="${hojeIso()}" required /></div></div></section>
      <section><p class="label">Categoria</p><div id="categorias" class="catGrid"></div></section>
      <section class="card"><label class="switchRow"><span class="switchText"><span class="switchIcon">↻</span><span><span class="switchTitle">Conta recorrente</span><span class="switchSub">Gera próximas parcelas automaticamente</span></span></span><input id="recorrente" type="checkbox" /></label><div id="recorrenciaWrap" class="field" style="display:none"><label for="recorrencia">Frequência</label><select id="recorrencia"><option value="mensal">Mensal</option><option value="bimestral">Bimestral</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual (ex: IPVA 1x)</option><option value="personalizada">Personalizada (escolher meses)</option></select></div><div id="mesesWrap" style="display:none"><p class="label">Meses do ano</p><div id="meses" class="months"></div></div></section>
      <div class="field"><label for="observacoes">Observações</label><textarea id="observacoes" name="observacoes" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></textarea></div>
      <button id="saveBtn" type="submit" class="save">✓ Salvar conta</button>
    </form>
  </main>
  <script>
    const SOURCE='contasfacil-nova-frame';const categorias=${categoriasJson};const mesesLabels=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];let categoriaId='';let meses=[];let busy=false;const $=(id)=>document.getElementById(id);const post=(message)=>parent.postMessage({source:SOURCE,...message},'*');const reportHeight=()=>post({type:'height',height:document.documentElement.scrollHeight+8});const notice=(text)=>{const el=$('notice');el.textContent=text;el.classList.add('show');reportHeight();setTimeout(()=>{el.classList.remove('show');reportHeight()},3500)};
    function escapeHtml(value){return String(value).replace(/[&<>'"]/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
    const EMOJIS={luz:'💡',internet:'📶',agua:'💧','água':'💧',gas:'🔥','gás':'🔥',cartao:'💳','cartão':'💳',boleto:'🧾',ipva:'🚗',carro:'🚗',mei:'📄',aluguel:'🏠',casa:'🏠',streaming:'📺',tv:'📺',mercado:'🛒',comida:'🍔',saude:'💊','saúde':'💊',educacao:'🎓','educação':'🎓',outros:'🏷️'};
    function emojiCat(cat){if(/\\p{Extended_Pictographic}/u.test(cat.icone||''))return cat.icone;return EMOJIS[String(cat.nome||'').trim().toLowerCase()]||'🏷️'}
    function renderCategorias(){$('categorias').innerHTML=categorias.map((cat)=>{const active=cat.id===categoriaId?' active':'';const emoji=emojiCat(cat);return '<button type="button" class="cat'+active+'" data-id="'+cat.id+'"><span class="catDot" style="color:'+(cat.cor||'#10b981')+';background:'+(cat.cor||'#10b981')+'1f">'+emoji+'</span><span class="catName">'+escapeHtml(cat.nome||'Categoria')+'</span></button>'}).join('');document.querySelectorAll('.cat').forEach((btn)=>{btn.addEventListener('click',()=>{categoriaId=btn.dataset.id||'';renderCategorias()})});reportHeight()}
    function renderMeses(){$('meses').innerHTML=mesesLabels.map((label,index)=>{const month=index+1;const active=meses.includes(month)?' active':'';return '<button type="button" class="month'+active+'" data-month="'+month+'">'+label+'</button>'}).join('');document.querySelectorAll('.month').forEach((btn)=>{btn.addEventListener('click',()=>{const month=Number(btn.dataset.month);meses=meses.includes(month)?meses.filter((m)=>m!==month):[...meses,month].sort((a,b)=>a-b);renderMeses()})});reportHeight()}
    function syncRecorrencia(){const recorrente=$('recorrente').checked;const personalizada=$('recorrencia').value==='personalizada';$('recorrenciaWrap').style.display=recorrente?'grid':'none';$('mesesWrap').style.display=recorrente&&personalizada?'block':'none';reportHeight()}
    function focusNative(target){if(!target||!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))return;setTimeout(()=>target.focus({preventScroll:false}),0)}
    document.addEventListener('pointerup',(event)=>focusNative(event.target),true);document.addEventListener('touchend',(event)=>focusNative(event.target),true);$('scanBtn').addEventListener('click',()=>post({type:'scan',mode:'scanner'}));$('photoBtn').addEventListener('click',()=>post({type:'scan',mode:'foto'}));$('recorrente').addEventListener('change',syncRecorrencia);$('recorrencia').addEventListener('change',syncRecorrencia);
    $('form').addEventListener('submit',(event)=>{event.preventDefault();if(busy)return;post({type:'submit',payload:{nome:$('nome').value,valor:$('valor').value,vencimento:$('vencimento').value,categoriaId,observacoes:$('observacoes').value,recorrente:$('recorrente').checked,recorrencia:$('recorrencia').value,meses}})});
    window.addEventListener('message',(event)=>{const data=event.data||{};if(data.source!=='contasfacil-nova-parent')return;if(data.type==='busy'){busy=Boolean(data.busy);$('saveBtn').disabled=busy;$('saveBtn').textContent=busy?'Salvando...':'✓ Salvar conta'}if(data.type==='scanResult'){const payload=data.payload||{};if(payload.nome&&!$('nome').value.trim())$('nome').value=payload.nome;if(payload.valor)$('valor').value=payload.valor;if(payload.vencimento)$('vencimento').value=payload.vencimento;notice((payload.tipo||'Código')+' lido. Confira os campos preenchidos.')}});
    new ResizeObserver(reportHeight).observe(document.body);renderCategorias();renderMeses();syncRecorrencia();reportHeight();
  </script>
</body>
</html>`;
}