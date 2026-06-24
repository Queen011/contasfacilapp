import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { iconeContasFacilUrl } from "@/lib/app-assets";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Entrar — Contas Fácil | Gestão de Contas e Vencimentos" },
      {
        name: "description",
        content:
          "Acesse o Contas Fácil para gerenciar suas contas a pagar, recorrentes e avulsas, e acompanhar vencimentos.",
      },
      {
        property: "og:title",
        content: "Entrar — Contas Fácil | Gestão de Contas e Vencimentos",
      },
      {
        property: "og:description",
        content:
          "Acesse o Contas Fácil para gerenciar suas contas a pagar, recorrentes e avulsas, e acompanhar vencimentos.",
      },
    ],
  }),
});

const GOOGLE_WEB_CLIENT_ID =
  "953013359097-pnpqpnrh8d652ts0gn9ph2fau46573lf.apps.googleusercontent.com";

let googleNativeInit: Promise<void> | null = null;

async function initializeNativeGoogleLogin() {
  if (!googleNativeInit) {
    googleNativeInit = (async () => {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      await SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_WEB_CLIENT_ID,
          mode: "online",
        },
      });
    })();
  }
  return googleNativeInit;
}

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const withTimeout = async <T,>(promise: Promise<T>, seconds = 25) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Tempo esgotado. Verifique sua internet e tente novamente.")),
        seconds * 1000,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  // Inicializa o login Google nativo compatível com Capacitor 8 quando rodando no APK
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      initializeNativeGoogleLogin().catch((err) => {
        googleNativeInit = null;
        console.error("Falha ao inicializar SocialLogin", err);
      });
    }
  }, []);

  const onGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);

    // No APK Android: usa o plugin nativo compatível com Capacitor 8 e troca o idToken por sessão
    if (Capacitor.isNativePlatform()) {
      try {
        await withTimeout(initializeNativeGoogleLogin(), 30);
        const { SocialLogin } = await import("@capgo/capacitor-social-login");
        const googleUser = await withTimeout(
          SocialLogin.login({
            provider: "google",
            options: {
              scopes: ["email", "profile"],
            },
          }),
          90,
        );
        const idToken =
          googleUser.result.responseType === "online" ? googleUser.result.idToken : null;
        if (!idToken) throw new Error("Token do Google não recebido");

        const { error } = await withTimeout(
          supabase.auth.signInWithIdToken({ provider: "google", token: idToken }),
        );
        if (error) throw error;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const code =
          typeof err === "object" && err !== null && "code" in err ? String(err.code) : "";
        if (msg.includes("Provider was not initialized")) googleNativeInit = null;
        if (!msg.toLowerCase().includes("cancel") && code !== "USER_CANCELLED") {
          toast.error(msg || "Falha ao entrar com Google");
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    // Web (preview / navegador): fluxo gerenciado pelo Lovable
    const result = await lovable.auth
      .signInWithOAuth("google", { redirect_uri: window.location.origin })
      .finally(() => setBusy(false));
    if (result.error) toast.error(result.error.message || "Falha ao entrar com Google");
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden px-6 pt-12 pb-10 flex items-center"
      style={{ background: "var(--gradient-soft)" }}
    >
      {/* Decorativos */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-72 w-72 rounded-full blur-3xl opacity-60"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full blur-3xl opacity-40 bg-primary/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
      />

      <div className="relative w-full max-w-sm mx-auto">
        {/* Cartão glass */}
        <div className="relative rounded-[2rem] border border-white/60 bg-white/70 backdrop-blur-xl p-8 shadow-[var(--shadow-elevated)] animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Ícone do app com selo */}
          <div className="flex justify-center -mt-16 mb-6">
            <div className="relative">
              <div
                className="grid place-items-center h-20 w-20 rounded-3xl rotate-6 shadow-xl shadow-primary/30 ring-8 ring-background/70"
                style={{ background: "var(--gradient-primary)" }}
              >
                <img
                  src={iconeContasFacilUrl}
                  alt="Ícone do Contas Fácil"
                  className="h-12 w-12 rounded-2xl object-cover -rotate-6"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 grid place-items-center h-7 w-7 rounded-full bg-card border border-border shadow">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            </div>
          </div>

          {/* Identidade */}
          <div className="text-center mb-7">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-primary/80 mb-2">
              Bem-vindo
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Contas <span className="text-primary">Fácil</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Sua vida financeira organizada — vencimentos, recorrentes e resumo do mês em um só lugar.
            </p>
          </div>

          {/* Micro-benefícios */}
          <ul className="mb-7 space-y-2.5">
            {[
              "Lembretes automáticos de vencimento",
              "Contas recorrentes e avulsas",
              "Resumo do mês com gráficos",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm text-foreground/80">
                <span className="grid place-items-center h-5 w-5 rounded-full bg-primary/10 shrink-0">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-primary" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                {t}
              </li>
            ))}
          </ul>

          {/* CTA Google */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-2xl font-semibold bg-card hover:bg-card border-border/80 shadow-sm hover:shadow-md transition-all active:scale-[0.98] touch-manipulation"
            disabled={busy}
            onClick={onGoogleSignIn}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {busy ? "Entrando…" : "Entrar com Google"}
          </Button>

          <p className="mt-4 text-[11px] text-center text-muted-foreground leading-relaxed">
            Ao continuar, você concorda com nossos{" "}
            <span className="underline underline-offset-2">Termos</span> e{" "}
            <span className="underline underline-offset-2">Privacidade</span>.
          </p>
        </div>

        {/* Rodapé */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          <span className="h-px w-6 bg-border" />
          Ambiente Seguro
          <span className="h-px w-6 bg-border" />
        </div>
      </div>
    </main>
  );
}
