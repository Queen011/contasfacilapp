import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type IARequestBody = { messages?: unknown; contexto?: unknown };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
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

export const Route = createFileRoute("/api/ia")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
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

        const body = (await request.json().catch(() => null)) as IARequestBody | null;
        let userMessages: ChatMessage[];
        try {
          userMessages = sanitizeMessages(body?.messages);
        } catch {
          return jsonError("Mensagens inválidas.", 400);
        }

        const contexto = typeof body?.contexto === "string" ? body.contexto.slice(0, 12_000) : "";
        const systemPrompt = `Você é a IA Financeira do app Contas Fácil, um assistente brasileiro especialista em finanças pessoais, contabilidade, MEI, impostos (IRPF, DASN, DAS), declarações e organização administrativa.

Responda sempre em português brasileiro, direto e prático. Use valores em R$ com duas casas quando calcular. Se faltar informação, faça perguntas curtas. Não invente valores das contas: use apenas o contexto fornecido. Em imposto/legal, inclua um lembrete curto de que é orientação geral.`;

        const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];
        if (contexto) messages.push({ role: "system", content: `Contexto das contas do usuário (JSON):\n${contexto}` });
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
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages,
              max_tokens: 700,
            }),
          });

          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            if (res.status === 429) return jsonError("Muitas requisições. Tente novamente em instantes.", 429);
            if (res.status === 402) return jsonError("Créditos de IA esgotados no workspace.", 402);
            return jsonError(`Falha na IA (${res.status}): ${txt.slice(0, 200)}`, 502);
          }

          const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const reply = json.choices?.[0]?.message?.content?.trim() || "Não consegui gerar uma resposta agora. Tente reformular a pergunta.";
          return Response.json({ reply }, { headers: corsHeaders });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return jsonError("A IA demorou demais. Tente uma pergunta mais curta.", 504);
          }
          return jsonError("Não foi possível conectar à IA agora.", 502);
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});