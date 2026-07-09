import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type IAInput = {
  messages: ChatMessage[];
  contexto?: string;
};

export const chatIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = input as IAInput;
    if (!data || !Array.isArray(data.messages)) throw new Error("mensagens inválidas");
    return {
      contexto: typeof data.contexto === "string" ? data.contexto.slice(0, 12_000) : undefined,
      messages: data.messages
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2_000) })),
    } satisfies IAInput;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const systemPrompt = `Você é a IA Financeira do app Contas Fácil, um assistente brasileiro especialista em finanças pessoais, contabilidade, MEI, impostos (IRPF, DASN, DAS), declarações e organização administrativa.

Sua missão:
- Sugerir cortes de gastos com base nas contas do usuário.
- Prever a sobra do mês.
- Ajudar em cálculos financeiros (juros, parcelamento, quitação antecipada).
- Orientar sobre declaração de imposto de renda pessoa física, MEI e outras obrigações administrativas comuns no Brasil.
- Explicar conceitos contábeis básicos em linguagem simples.

Regras:
- Responda SEMPRE em português brasileiro, direto e prático.
- Use valores em R$ com duas casas quando calcular.
- Se faltar informação, faça perguntas curtas e objetivas.
- Não invente valores das contas: use apenas os dados do contexto fornecido.
- Não é assessor licenciado — inclua um lembrete curto quando o assunto for imposto/legal.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];
    if (data.contexto) {
      messages.push({
        role: "system",
        content: `Contexto das contas do usuário (JSON):\n${data.contexto}`,
      });
    }
    messages.push(...data.messages);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          max_tokens: 700,
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("A IA demorou demais. Tente uma pergunta mais curta.");
      }
      throw new Error("Não foi possível conectar à IA agora.");
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content?.trim() || "Não consegui gerar uma resposta agora. Tente reformular a pergunta.";
    return { reply };
  });
