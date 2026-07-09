import { createFileRoute, Link } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useContas } from "@/lib/queries";
import { formatBRL } from "@/lib/finance";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/ia")({
  component: IAPage,
  head: () => ({
    meta: [
      { title: "IA Financeira — Contas Fácil" },
      { name: "description", content: "Assistente de finanças, impostos e contabilidade para pessoas físicas e MEI." },
    ],
  }),
});

type Msg = { role: "user" | "assistant"; content: string };
type IAFrameMessage =
  | { source: "contasfacil-ia-frame"; type: "submit"; text: string }
  | { source: "contasfacil-ia-frame"; type: "height"; height: number };

const SUGESTOES = [
  "Como economizar este mês?",
  "Qual a previsão da minha sobra?",
  "Como declarar meu MEI?",
  "Vale a pena antecipar meu cartão?",
];

const HOSTED_IA_API = "https://id-preview--196760e9-63de-415c-88d4-196eabcd6825.lovable.app/api/ia";

function getIaEndpoints() {
  if (typeof window === "undefined") return ["/api/ia"];
  const protocol = window.location.protocol;
  const isWebHttp = protocol === "http:" || protocol === "https:";
  if (Capacitor.isNativePlatform() || !isWebHttp) return [HOSTED_IA_API];
  return ["/api/ia", HOSTED_IA_API];
}

async function chamarIA(data: { messages: Msg[]; contexto: string }, sessionToken?: string) {
  const token = sessionToken || (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  let lastError: Error | null = null;

  for (const endpoint of getIaEndpoints()) {
    const hosted = endpoint.startsWith("https://");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 35_000);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: hosted
          ? { "Content-Type": "text/plain", Accept: "application/json" }
          : { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(hosted ? { ...data, accessToken: token } : data),
      });

      const json = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
      if (res.ok) {
        return { reply: json?.reply || "Não consegui gerar uma resposta agora. Tente reformular a pergunta." };
      }

      lastError = new Error(json?.error || `Erro na IA (${res.status}).`);
      if (res.status === 404 && !hosted) continue;
      throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Erro na IA.");
      if (lastError.name === "AbortError") lastError = new Error("A IA demorou demais. Tente uma pergunta mais curta.");
      if (!hosted) continue;
      throw lastError;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("Erro na IA.");
}

function IAPage() {
  const { session } = useAuth();
  const { data: contas = [] } = useContas();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Oi! 👋 Sou sua **IA Financeira** do Contas Fácil.\n\nPosso te ajudar a:\n\n1. **Economizar** — analiso suas contas e sugiro cortes.\n2. **Prever a sobra** do mês.\n3. **MEI e Imposto de Renda** — passo a passo.\n4. **Cálculos** — juros, parcelamento, quitação.\n\n💡 Escolha uma sugestão abaixo ou me conte sua dúvida.",
    },
  ]);
  const [iframeHeight, setIframeHeight] = useState(190);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const frameHtml = useMemo(() => buildIAFrameHtml(SUGESTOES), []);

  const contexto = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const doMes = contas.filter((c) => c.vencimento.startsWith(ym));
    const totalMes = doMes.reduce((s, c) => s + Number(c.valor), 0);
    const atrasadas = contas.filter((c) => c.status === "atrasada");
    const pendentes = contas.filter((c) => c.status === "pendente");
    return JSON.stringify({
      mes: ym,
      totalMes: formatBRL(totalMes),
      totalAtrasado: formatBRL(atrasadas.reduce((s, c) => s + Number(c.valor), 0)),
      quantidade: {
        pendentes: pendentes.length,
        atrasadas: atrasadas.length,
        total: contas.length,
      },
      contas: doMes.slice(0, 30).map((c) => ({
        nome: c.nome,
        valor: Number(c.valor),
        vencimento: c.vencimento,
        status: c.status,
        categoria: c.categoria?.nome ?? null,
        recorrencia: c.recorrencia,
      })),
    });
  }, [contas]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "contasfacil-ia-parent", type: "busy", busy: loading },
      "*",
    );
  }, [loading]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<IAFrameMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "contasfacil-ia-frame") return;
      if (data.type === "height") setIframeHeight(Math.max(150, Math.min(320, data.height)));
      if (data.type === "submit") enviar(data.text);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [messages, loading, contexto]);

  const enviar = async (texto: string) => {
    const q = texto.trim();
    if (!q || loading) return;
    const nova: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(nova);
    setLoading(true);
    try {
      const { reply } = await chamarIA({ messages: nova, contexto }, session?.access_token);
      setMessages([...nova, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro na IA.";
      toast.error(msg);
      setMessages([...nova, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pad-fluid-x pt-6 pb-4 flex flex-col" style={{ minHeight: "calc(100vh - 6rem)" }}>
      <header className="flex items-center gap-2 mb-4">
        <Link
          to="/"
          className="grid place-items-center size-10 rounded-2xl bg-card border border-border shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-fluid-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-primary" /> IA Financeira
          </h1>
          <p className="text-fluid-xs text-muted-foreground">Cortes, previsões, MEI, imposto de renda.</p>
        </div>
      </header>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-3 pb-4"
        style={{ maxHeight: "calc(100vh - 18rem)" }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl p-3 text-sm whitespace-pre-wrap break-words ${
              m.role === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : "bg-card border border-border mr-8"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="rounded-2xl p-3 text-sm bg-card border border-border mr-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Pensando…
          </div>
        )}
      </div>

      <iframe
        ref={iframeRef}
        title="Pergunta para IA Financeira"
        srcDoc={frameHtml}
        className="block w-full bg-transparent sticky bottom-0"
        style={{ height: iframeHeight, border: 0 }}
        sandbox="allow-scripts allow-forms allow-same-origin"
        aria-busy={loading}
      />
    </div>
  );
}

function buildIAFrameHtml(sugestoes: string[]) {
  const sugestoesJson = JSON.stringify(sugestoes).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <style>
    :root{color-scheme:only light;--card:#ffffff;--text:#123033;--muted:#667a7b;--border:#dbecea;--primary:#12b981;--secondary:#e8f8f3;--shadow-card:0 2px 12px -2px rgba(10,120,100,.14);font-family:"Plus Jakarta Sans",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;background:transparent;color:var(--text);font-family:inherit}body{overflow:hidden;padding:0 0 8px}button,textarea{font:inherit;font-size:16px}button{border:0;cursor:pointer;touch-action:manipulation}.suggestions{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}.suggestions::-webkit-scrollbar{display:none}.chip{flex:0 0 auto;min-height:34px;border-radius:999px;background:var(--secondary);color:var(--text);padding:0 12px;font-size:12px;font-weight:800}.composer{display:flex;align-items:flex-end;gap:8px;background:#fff;border:1px solid var(--border);border-radius:22px;padding:8px;box-shadow:var(--shadow-card)}textarea{width:100%;min-height:48px;max-height:112px;border:0;background:#fff!important;color:#111827!important;-webkit-text-fill-color:#111827!important;caret-color:#111827!important;padding:12px 8px;outline:none;line-height:1.25;resize:none;opacity:1!important;user-select:text;-webkit-user-select:text}textarea::placeholder{color:#6b7280;-webkit-text-fill-color:#6b7280;opacity:1}.send{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;flex:none;background:var(--primary);color:#fff;font-size:20px;font-weight:900}.send:disabled{opacity:.55}
  </style>
</head>
<body>
  <div id="suggestions" class="suggestions"></div>
  <form id="form" class="composer" novalidate>
    <textarea id="input" rows="1" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="send" placeholder="Pergunte algo…"></textarea>
    <button id="send" type="submit" class="send" aria-label="Enviar">➤</button>
  </form>
  <script>
    const SOURCE='contasfacil-ia-frame';const sugestoes=${sugestoesJson};let busy=false;const $=(id)=>document.getElementById(id);const post=(message)=>parent.postMessage({source:SOURCE,...message},'*');const reportHeight=()=>post({type:'height',height:document.documentElement.scrollHeight+8});
    function escapeHtml(value){return String(value).replace(/[&<>'"]/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
    function syncHeight(){const input=$('input');input.style.height='48px';input.style.height=Math.min(input.scrollHeight,112)+'px';reportHeight()}
    function sendText(text){const value=String(text||$('input').value).trim();if(!value||busy)return;post({type:'submit',text:value});$('input').value='';syncHeight();$('suggestions').style.display='none'}
    function renderSuggestions(){$('suggestions').innerHTML=sugestoes.map((s)=>'<button type="button" class="chip" data-text="'+escapeHtml(s)+'">'+escapeHtml(s)+'</button>').join('');document.querySelectorAll('.chip').forEach((btn)=>btn.addEventListener('click',()=>sendText(btn.dataset.text||'')));reportHeight()}
    function focusNative(target){if(!target||target.tagName!=='TEXTAREA')return;setTimeout(()=>target.focus({preventScroll:false}),0)}
    document.addEventListener('pointerup',(event)=>focusNative(event.target),true);document.addEventListener('touchend',(event)=>focusNative(event.target),true);$('input').addEventListener('input',syncHeight);$('input').addEventListener('keydown',(event)=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendText('')}});$('form').addEventListener('submit',(event)=>{event.preventDefault();sendText('')});window.addEventListener('message',(event)=>{const data=event.data||{};if(data.source!=='contasfacil-ia-parent')return;if(data.type==='busy'){busy=Boolean(data.busy);$('send').disabled=busy;$('send').textContent=busy?'…':'➤';if(!busy)setTimeout(()=>$('input').focus({preventScroll:false}),0)}});renderSuggestions();syncHeight();
  </script>
</body>
</html>`;
}
