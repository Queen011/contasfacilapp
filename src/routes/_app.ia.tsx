import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { chatIA } from "@/lib/ia.functions";
import { useContas } from "@/lib/queries";
import { formatBRL } from "@/lib/finance";
import { Button } from "@/components/ui/button";

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

const SUGESTOES = [
  "Como economizar este mês?",
  "Qual a previsão da minha sobra?",
  "Como declarar meu MEI?",
  "Vale a pena antecipar meu cartão?",
];

function IAPage() {
  const chat = useServerFn(chatIA);
  const { data: contas = [] } = useContas();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Olá! Sou a IA Financeira do Contas Fácil. Pergunte sobre suas contas, impostos, MEI, cortes de gastos ou cálculos.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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

  const enviar = async (texto: string) => {
    const q = texto.trim();
    if (!q || loading) return;
    setInput("");
    const nova: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(nova);
    setLoading(true);
    try {
      const { reply } = await chat({ data: { messages: nova, contexto } });
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

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => enviar(s)}
              className="text-xs rounded-full bg-secondary text-secondary-foreground px-3 py-1.5"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(input);
        }}
        className="flex gap-2 sticky bottom-0 bg-background pb-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo…"
          className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()} size="icon" className="size-12 rounded-2xl">
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
}
