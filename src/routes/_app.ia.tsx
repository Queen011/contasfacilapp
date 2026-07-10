import { createFileRoute, Link } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Sparkles, Loader2, MessageSquarePlus, History, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useContas } from "@/lib/queries";
import { formatBRL } from "@/lib/finance";
import { useAuth } from "@/lib/auth";
import { MobilePanel } from "@/components/MobilePanel";

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
type Thread = { id: string; title: string; updated_at: string };
type IAFrameMessage =
  | { source: "contasfacil-ia-frame"; type: "submit"; text: string }
  | { source: "contasfacil-ia-frame"; type: "height"; height: number };

const SUGESTOES = [
  "Como economizar este mês?",
  "Qual a previsão da minha sobra?",
  "Como declarar meu MEI?",
  "Vale a pena antecipar meu cartão?",
];

const ATALHOS_IA: Record<string, string> = {
  "1": "Quero economizar este mês. Analise minhas contas e me dê um plano simples com cortes possíveis, prioridades e próximos passos.",
  "2": "Quero prever a sobra do mês. Use minhas contas cadastradas para calcular o total previsto e explique passo a passo o que falta pagar.",
  "3": "Quero ajuda com MEI e Imposto de Renda. Explique o passo a passo e me pergunte só o que for essencial para orientar melhor.",
  "4": "Quero fazer cálculos financeiros. Explique quais dados preciso informar para calcular juros, parcelamento ou quitação e dê exemplos claros.",
};

const HOSTED_IA_API = "https://id-preview--196760e9-63de-415c-88d4-196eabcd6825.lovable.app/api/ia";
const ACTIVE_THREAD_KEY = "contasfacil.ia.activeThreadId";

const SAUDACAO_INICIAL: Msg = {
  role: "assistant",
  content:
    "Oi! 👋 Sou sua **IA Financeira** do Contas Fácil.\n\nVocê pode digitar só o número da opção:\n\n1. **Economizar** — analiso suas contas e sugiro cortes.\n2. **Prever a sobra** do mês.\n3. **MEI e Imposto de Renda** — passo a passo.\n4. **Cálculos** — juros, parcelamento, quitação.\n\n💡 Se preferir, escreva sua dúvida do seu jeito.",
};

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

function normalizarComandoIA(texto: string) {
  const limpo = texto.trim().toLowerCase();
  const numero = limpo.match(/^(?:op[cç][aã]o\s*)?([1-4])(?:[\).\-\s]*)?$/)?.[1];
  if (numero && ATALHOS_IA[numero]) return ATALHOS_IA[numero];
  return texto.trim();
}

function tituloAPartirDe(texto: string) {
  const limpo = texto.trim().replace(/\s+/g, " ");
  if (!limpo) return "Nova conversa";
  return limpo.length > 42 ? limpo.slice(0, 42).trimEnd() + "…" : limpo;
}

function formatarQuando(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmo = d.toDateString() === hoje.toDateString();
  if (mesmo) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function IAPage() {
  const { session, user } = useAuth();
  const { data: contas = [] } = useContas();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([SAUDACAO_INICIAL]);
  const [iframeHeight, setIframeHeight] = useState(190);
  const [loading, setLoading] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
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
      quantidade: { pendentes: pendentes.length, atrasadas: atrasadas.length, total: contas.length },
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

  // Carrega threads do usuário
  const recarregarThreads = useCallback(async () => {
    if (!user) return [] as Thread[];
    const { data, error } = await supabase
      .from("ia_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Não consegui carregar seu histórico.");
      return [] as Thread[];
    }
    const lista = (data ?? []) as Thread[];
    setThreads(lista);
    return lista;
  }, [user]);

  const carregarMensagensDo = useCallback(async (threadId: string) => {
    const { data, error } = await supabase
      .from("ia_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Não consegui abrir esta conversa.");
      return;
    }
    const msgs = (data ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    setMessages(msgs.length ? msgs : [SAUDACAO_INICIAL]);
  }, []);

  // Bootstrap: carregar threads e escolher ativa
  useEffect(() => {
    if (!user) return;
    (async () => {
      const lista = await recarregarThreads();
      const salvo = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_THREAD_KEY) : null;
      const escolhida = lista.find((t) => t.id === salvo) ?? lista[0] ?? null;
      if (escolhida) {
        setActiveThreadId(escolhida.id);
        await carregarMensagensDo(escolhida.id);
      } else {
        setActiveThreadId(null);
        setMessages([SAUDACAO_INICIAL]);
      }
    })();
  }, [user, recarregarThreads, carregarMensagensDo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeThreadId) window.localStorage.setItem(ACTIVE_THREAD_KEY, activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "contasfacil-ia-parent", type: "busy", busy: loading },
      "*",
    );
  }, [loading]);

  const enviar = useCallback(
    async (texto: string) => {
      const q = normalizarComandoIA(texto);
      if (!q || loading || !user) return;
      const mostrado = texto.trim();
      const nova: Msg[] = [...messages, { role: "user", content: mostrado }];
      setMessages(nova);
      setLoading(true);

      // Garante thread ativa
      let threadId = activeThreadId;
      try {
        if (!threadId) {
          const { data: criada, error: errT } = await supabase
            .from("ia_threads")
            .insert({ user_id: user.id, title: tituloAPartirDe(mostrado) })
            .select("id, title, updated_at")
            .single();
          if (errT || !criada) throw errT ?? new Error("Não foi possível criar a conversa.");
          threadId = criada.id;
          setActiveThreadId(criada.id);
          setThreads((prev) => [criada as Thread, ...prev]);
        } else {
          // Se ainda tem título padrão, renomeia com a primeira pergunta
          const atual = threads.find((t) => t.id === threadId);
          if (atual && atual.title === "Nova conversa") {
            await supabase
              .from("ia_threads")
              .update({ title: tituloAPartirDe(mostrado) })
              .eq("id", threadId);
            setThreads((prev) =>
              prev.map((t) => (t.id === threadId ? { ...t, title: tituloAPartirDe(mostrado) } : t)),
            );
          }
        }

        // Persiste mensagem do usuário
        await supabase.from("ia_messages").insert({
          thread_id: threadId,
          user_id: user.id,
          role: "user",
          content: mostrado,
        });

        const mensagensParaIA: Msg[] = q === mostrado ? nova : [...messages, { role: "user", content: q }];
        const { reply } = await chamarIA({ messages: mensagensParaIA, contexto }, session?.access_token);
        setMessages([...nova, { role: "assistant", content: reply }]);

        await supabase.from("ia_messages").insert({
          thread_id: threadId,
          user_id: user.id,
          role: "assistant",
          content: reply,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro na IA.";
        toast.error(msg);
        setMessages([...nova, { role: "assistant", content: `⚠️ ${msg}` }]);
      } finally {
        setLoading(false);
      }
    },
    [activeThreadId, contexto, loading, messages, session?.access_token, threads, user],
  );

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
  }, [enviar]);

  const novaConversa = useCallback(() => {
    setActiveThreadId(null);
    setMessages([SAUDACAO_INICIAL]);
    if (typeof window !== "undefined") window.localStorage.removeItem(ACTIVE_THREAD_KEY);
    setHistoricoAberto(false);
  }, []);

  const abrirThread = useCallback(
    async (id: string) => {
      setActiveThreadId(id);
      setHistoricoAberto(false);
      await carregarMensagensDo(id);
    },
    [carregarMensagensDo],
  );

  const apagarThread = useCallback(
    async (id: string) => {
      if (!confirm("Apagar esta conversa? Não dá pra desfazer.")) return;
      const { error } = await supabase.from("ia_threads").delete().eq("id", id);
      if (error) {
        toast.error("Não deu para apagar.");
        return;
      }
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeThreadId === id) novaConversa();
      toast.success("Conversa apagada.");
    },
    [activeThreadId, novaConversa],
  );

  const ultimaPerguntaUsuario = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return null;
  }, [messages]);

  const repetirUltimaPergunta = useCallback(() => {
    if (!ultimaPerguntaUsuario || loading) return;
    enviar(ultimaPerguntaUsuario);
  }, [enviar, loading, ultimaPerguntaUsuario]);

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
          <p className="text-fluid-xs text-muted-foreground truncate">
            {threads.find((t) => t.id === activeThreadId)?.title ?? "Nova conversa"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHistoricoAberto(true)}
          className="grid place-items-center size-10 rounded-2xl bg-card border border-border shrink-0"
          aria-label="Histórico de conversas"
          title="Histórico"
        >
          <History size={18} />
        </button>
        <button
          type="button"
          onClick={novaConversa}
          className="grid place-items-center size-10 rounded-2xl bg-primary text-primary-foreground shrink-0"
          aria-label="Nova conversa"
          title="Nova conversa"
        >
          <MessageSquarePlus size={18} />
        </button>
      </header>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-3 pb-4"
        style={{ maxHeight: "calc(100vh - 20rem)" }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl p-3 text-sm break-words ${
              m.role === "user"
                ? "bg-primary text-primary-foreground ml-8 whitespace-pre-wrap"
                : "bg-card border border-border mr-8 ia-markdown"
            }`}
          >
            {m.role === "user" ? (
              m.content
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                  h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
                  code: ({ children }) => (
                    <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">{children}</code>
                  ),
                  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline break-all">
                      {children}
                    </a>
                  ),
                }}
              >
                {m.content}
              </ReactMarkdown>
            )}
          </div>
        ))}
        {loading && (
          <div className="rounded-2xl p-3 text-sm bg-card border border-border mr-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Pensando…
          </div>
        )}
      </div>

      {ultimaPerguntaUsuario && !loading && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={repetirUltimaPergunta}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground shadow-sm"
            title={`Refazer: ${ultimaPerguntaUsuario.slice(0, 60)}`}
          >
            <RotateCcw size={13} /> Refazer última pergunta
          </button>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title="Pergunta para IA Financeira"
        srcDoc={frameHtml}
        className="block w-full bg-transparent sticky bottom-0"
        style={{ height: iframeHeight, border: 0 }}
        sandbox="allow-scripts allow-forms allow-same-origin"
        aria-busy={loading}
      />

      {historicoAberto && (
        <MobilePanel title="Histórico de conversas" onClose={() => setHistoricoAberto(false)}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={novaConversa}
              className="flex items-center gap-2 rounded-2xl border border-border bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary"
            >
              <MessageSquarePlus size={16} /> Nova conversa
            </button>
            {threads.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                Nenhuma conversa salva ainda. Faça uma pergunta pra começar.
              </p>
            )}
            {threads.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm ${
                  t.id === activeThreadId ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <button
                  type="button"
                  onClick={() => abrirThread(t.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="font-semibold truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{formatarQuando(t.updated_at)}</p>
                </button>
                <button
                  type="button"
                  onClick={() => apagarThread(t.id)}
                  className="grid place-items-center size-8 rounded-xl text-muted-foreground hover:text-destructive"
                  aria-label={`Apagar ${t.title}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </MobilePanel>
      )}
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
