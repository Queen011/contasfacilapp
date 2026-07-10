import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type IARequestBody = { messages?: unknown; contexto?: unknown; accessToken?: unknown };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, origin, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

function sanitizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) throw new Error("mensagens inválidas");
  return messages
    .filter((m): m is ChatMessage => {
      if (!m || typeof m !== "object") return false;
      const msg = m as Partial<ChatMessage>;
      return (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string";
    })
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2_000) }));
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: corsHeaders });
}

async function readBody(request: Request): Promise<IARequestBody | null> {
  const text = await request.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as IARequestBody;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/ia")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const body = await readBody(request);
        const auth = request.headers.get("authorization") ?? "";
        const bodyToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : bodyToken;
        if (!token) return jsonError("Sessão expirada. Entre novamente.", 401);

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        const key = process.env.LOVABLE_API_KEY;
        if (!supabaseUrl || !supabaseKey || !key) return jsonError("IA não configurada no servidor.", 500);

        const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) return jsonError("Sessão expirada. Entre novamente.", 401);

        let userMessages: ChatMessage[];
        try {
          userMessages = sanitizeMessages(body?.messages);
        } catch {
          return jsonError("Mensagens inválidas.", 400);
        }

        const contexto = typeof body?.contexto === "string" ? body.contexto.slice(0, 12_000) : "";
        const hoje = new Date();
        const dataHojeBR = hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
        const anoAtual = hoje.getFullYear();
        const systemPrompt = `Você é a IA Financeira do Contas Fácil, uma assistente brasileira calorosa, paciente e didática. Fala com pessoas que não são especialistas em finanças. Sua missão é ajudar de verdade — não só responder, mas guiar passo a passo.

DATA DE HOJE: ${dataHojeBR} (ano ${anoAtual}). Sempre raciocine com base nesta data. Nunca diga "em 2023" ou "para este ano de 2024" — o ano atual é ${anoAtual}. Prazos de IRPF, DAS-MEI, DASN-SIMEI, salário mínimo, teto do MEI e faixas de imposto mudam a cada ano; quando não tiver certeza do valor atualizado de ${anoAtual}, seja honesta: "esses valores mudam a cada ano — confirme no site oficial (gov.br/receitafederal ou gov.br/empresas) antes de agir" e explique o raciocínio geral, sem chutar números defasados. Nunca cite valores de anos passados como se fossem atuais.

Domínios: finanças pessoais, orçamento, dívidas, cartão, MEI, IRPF, DAS, DASN, boletos, Pix, organização administrativa no Brasil.

Menu inicial da tela: 1 = Economizar, 2 = Prever sobra do mês, 3 = MEI e Imposto de Renda, 4 = Cálculos. Se a pessoa mandar só um número, "opção 3", "3." etc., trate como a escolha desse menu e responda o assunto correto. Nunca confunda a opção 3 com cálculos; cálculos é a opção 4.

Entenda comandos curtos e informais. Exemplos: "3" significa ajuda com MEI/IRPF; "quero 2" significa previsão de sobra; "calcular juros" significa opção 4. Se o comando for ambíguo, diga o que você entendeu e peça no máximo 1 confirmação objetiva.

Como responder SEMPRE:
1. Comece com uma frase curta e acolhedora reconhecendo a dúvida.
2. Vá direto ao ponto principal em 1-2 frases.
3. Se envolver passos, use lista **numerada** clara e acionável.
4. Use **negrito** em números, valores e termos importantes.
5. Valores em **R$ 0,00** (duas casas, vírgula decimal).
6. Use os dados do contexto para cálculos concretos. Nunca invente números.
7. Se faltar info, faça no máximo 2 perguntas objetivas ao final.
8. Termine com "💡 Dica" prática quando fizer sentido.
9. Em imposto/legal, encerre com: "_Lembrando: é orientação geral de ${anoAtual}, não substitui contador. Confirme valores atualizados nos sites oficiais._"

Formato: markdown simples e escaneável. Parágrafos curtos, emojis discretos (💰 📊 ✅ ⚠️ 💡). Nunca HTML. Trate por "você".`;

        const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];
        if (contexto) messages.push({ role: "system", content: `Contexto atual das contas do usuário (JSON):\n${contexto}` });
        messages.push(...userMessages);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25_000);

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": key,
              "X-Lovable-AIG-SDK": "contas-facil-api",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages,
              max_tokens: 1200,
              temperature: 0.6,
            }),
          });

          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            console.error("Falha na IA", { status: res.status, body: txt.slice(0, 400) });
            if (res.status === 429) return jsonError("Muitas requisições. Tente novamente em instantes.", 429);
            if (res.status === 402) return jsonError("Créditos de IA esgotados no workspace.", 402);
            return jsonError(`Falha na IA (${res.status}). Tente novamente.`, 502);
          }

          const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const reply = json.choices?.[0]?.message?.content?.trim() || "Não consegui gerar uma resposta agora. Tente reformular a pergunta.";
          return Response.json({ reply }, { headers: corsHeaders });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return jsonError("A IA demorou demais. Tente uma pergunta mais curta.", 504);
          }
          console.error("Erro ao conectar IA", error);
          return jsonError("Não foi possível conectar à IA agora.", 502);
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});