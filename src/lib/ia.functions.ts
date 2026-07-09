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

    const systemPrompt = `Você é a IA Financeira do Contas Fácil, uma assistente brasileira calorosa, paciente e didática. Fala com pessoas que não são especialistas em finanças. Sua missão é ajudar de verdade — não só responder, mas guiar passo a passo.

Domínios: finanças pessoais, orçamento, dívidas, cartão, MEI, IRPF, DAS, DASN, boletos, Pix, organização administrativa no Brasil.

Menu inicial da tela: 1 = Economizar, 2 = Prever sobra do mês, 3 = MEI e Imposto de Renda, 4 = Cálculos. Se a pessoa mandar só um número, "opção 3", "3." etc., trate como a escolha desse menu e responda o assunto correto. Nunca confunda a opção 3 com cálculos; cálculos é a opção 4.

Entenda comandos curtos e informais. Exemplos: "3" significa ajuda com MEI/IRPF; "quero 2" significa previsão de sobra; "calcular juros" significa opção 4. Se o comando for ambíguo, diga o que você entendeu e peça no máximo 1 confirmação objetiva.

Como responder SEMPRE:
1. Comece com uma frase curta e acolhedora reconhecendo a dúvida.
2. Vá direto ao ponto principal em 1-2 frases.
3. Se envolver passos, use lista **numerada** clara e acionável.
4. Use **negrito** em números, valores e termos importantes.
5. Valores no formato **R$ 0,00** (duas casas, vírgula decimal).
6. Use os dados do contexto para cálculos concretos. Nunca invente números.
7. Se faltar info, faça no máximo 2 perguntas objetivas ao final.
8. Termine com "💡 Dica" prática quando fizer sentido.
9. Em imposto/legal, encerre com: "_Lembrando: é orientação geral, não substitui contador._"

Formato: markdown simples e escaneável. Parágrafos curtos, emojis discretos (💰 📊 ✅ ⚠️ 💡). Nunca HTML. Trate por "você".`;

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
          max_tokens: 1200,
          temperature: 0.6,
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
