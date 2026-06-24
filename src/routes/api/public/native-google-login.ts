import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const ALLOWED_GOOGLE_CLIENT_IDS = new Set([
  "953013359097-pnpqpnrh8d652ts0gn9ph2fau46573lf.apps.googleusercontent.com",
  "953013359097-j4v5rb37kr8i4fbkh3d62rtdalo38imc.apps.googleusercontent.com",
  "953013359097-n6hvo7go341dfhouaucq0v071k57pi3k.apps.googleusercontent.com",
]);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "content-type": "application/json; charset=utf-8",
};

const inputSchema = z.object({ idToken: z.string().min(20) });

type GoogleTokenInfo = {
  aud?: string | string[];
  email?: string;
  email_verified?: string | boolean;
  exp?: string;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, ...init?.headers },
  });
}

function hasAllowedAudience(aud: GoogleTokenInfo["aud"]) {
  if (Array.isArray(aud)) return aud.some((value) => ALLOWED_GOOGLE_CLIENT_IDS.has(value));
  return typeof aud === "string" && ALLOWED_GOOGLE_CLIENT_IDS.has(aud);
}

function isEmailVerified(value: GoogleTokenInfo["email_verified"]) {
  return value === true || value === "true";
}

async function verifyGoogleToken(idToken: string) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { headers: { accept: "application/json" } },
  );

  if (!response.ok) {
    throw new Error("Token do Google inválido ou expirado. Tente entrar novamente.");
  }

  const tokenInfo = (await response.json()) as GoogleTokenInfo;
  const expiresAt = Number(tokenInfo.exp ?? 0);

  if (tokenInfo.iss !== "accounts.google.com" && tokenInfo.iss !== "https://accounts.google.com") {
    throw new Error("Emissor do token Google inválido.");
  }

  if (!hasAllowedAudience(tokenInfo.aud)) {
    throw new Error("Client ID do Google não autorizado para este app.");
  }

  if (!expiresAt || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error("Token do Google expirado. Tente entrar novamente.");
  }

  if (!tokenInfo.email || !isEmailVerified(tokenInfo.email_verified) || !tokenInfo.sub) {
    throw new Error("O Google não confirmou este e-mail.");
  }

  return tokenInfo;
}

export const Route = createFileRoute("/api/public/native-google-login")({
  server: {
    handlers: {
      OPTIONS: async () => jsonResponse({ ok: true }),
      POST: async ({ request }) => {
        try {
          const { idToken } = inputSchema.parse(await request.json());
          const tokenInfo = await verifyGoogleToken(idToken);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: tokenInfo.email!,
            options: {
              data: {
                avatar_url: tokenInfo.picture,
                full_name: tokenInfo.name,
                google_sub: tokenInfo.sub,
              },
            },
          });

          if (linkError || !linkData.properties?.hashed_token) {
            throw new Error(linkError?.message || "Não foi possível criar a sessão do Google.");
          }

          const supabaseUrl = process.env.SUPABASE_URL;
          const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

          if (!supabaseUrl || !supabasePublishableKey) {
            throw new Error("Configuração de autenticação ausente no servidor.");
          }

          const authClient = createClient<Database>(supabaseUrl, supabasePublishableKey, {
            auth: {
              storage: undefined,
              persistSession: false,
              autoRefreshToken: false,
            },
          });

          const { data: sessionData, error: sessionError } = await authClient.auth.verifyOtp({
            token_hash: linkData.properties.hashed_token,
            type: "magiclink",
          });

          if (sessionError || !sessionData.session) {
            throw new Error(sessionError?.message || "Não foi possível validar a sessão do Google.");
          }

          return jsonResponse({
            tokens: {
              access_token: sessionData.session.access_token,
              refresh_token: sessionData.session.refresh_token,
            },
          });
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "Falha ao entrar com Google." },
            { status: 400 },
          );
        }
      },
    },
  },
});