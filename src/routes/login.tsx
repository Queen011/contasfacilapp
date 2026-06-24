import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";

import { useEffect, useRef, useState } from "react";
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
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpo = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";
    if (!emailLimpo) return toast.error("Informe seu e-mail.");
    if (!emailLimpo.includes("@")) return toast.error("Informe um e-mail válido.");
    if (password.length < 6) {
      return toast.error("A senha precisa de no mínimo 6 caracteres.");
    }
    setBusy(true);
    const fn = mode === "login" ? signIn : signUp;
    const { error } = await withTimeout(fn(emailLimpo, password))
      .catch((err) => ({
        error: err instanceof Error ? err.message : "Falha ao entrar. Tente novamente.",
      }))
      .finally(() => setBusy(false));
    if (error) return toast.error(error);
    if (mode === "signup") {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    }
  };

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
      className="min-h-screen px-6 pt-10 pb-16"
      style={{ background: "var(--gradient-soft)" }}
    >
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
          <img
            src={iconeContasFacilUrl}
            alt="Ícone do Contas Fácil"
            className="mx-auto h-20 w-20 rounded-3xl object-cover shadow-lg mb-4"
          />
          <h1 className="text-3xl font-extrabold tracking-tight">Contas Fácil</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gestão de contas e vencimentos — suas contas organizadas em um só lugar
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="relative z-10 bg-card rounded-3xl p-6 shadow-[var(--shadow-card)] space-y-4"
        >
          <div className="grid grid-cols-2 rounded-2xl bg-secondary p-1 touch-manipulation">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`h-12 rounded-xl text-sm font-semibold transition cursor-pointer select-none ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`h-12 rounded-xl text-sm font-semibold transition cursor-pointer select-none ${
                mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-medium leading-none">
              E-mail
            </label>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="text"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              placeholder="voce@exemplo.com"
              enterKeyHint="next"
              className="mt-1.5 flex h-11 w-full rounded-xl border border-input bg-background px-3 py-1 text-base shadow-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium leading-none">
              Senha
            </label>
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Mínimo 6 caracteres"
              enterKeyHint="done"
              className="mt-1.5 flex h-11 w-full rounded-xl border border-input bg-background px-3 py-1 text-base shadow-sm outline-none focus:border-primary"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full h-12 rounded-xl text-base font-semibold touch-manipulation"
            style={{ background: "var(--gradient-primary)" }}
          >
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-xl font-semibold touch-manipulation"
            disabled={busy}
            onClick={onGoogleSignIn}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com Google
          </Button>
        </form>
      </div>
    </main>
  );
}
