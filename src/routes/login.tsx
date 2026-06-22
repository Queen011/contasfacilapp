import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Entrar — Contas Fácil | Gestão de Contas e Vencimentos" },
      { name: "description", content: "Acesse o Contas Fácil para gerenciar suas contas a pagar, recorrentes e avulsas, e acompanhar vencimentos." },
      { property: "og:title", content: "Entrar — Contas Fácil | Gestão de Contas e Vencimentos" },
      { property: "og:description", content: "Acesse o Contas Fácil para gerenciar suas contas a pagar, recorrentes e avulsas, e acompanhar vencimentos." },
    ],
  }),
});

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

function isNativeAppRuntime() {
  if (typeof window === "undefined") return false;
  const capacitor = (window as CapacitorWindow).Capacitor;
  return capacitor?.isNativePlatform?.() ?? capacitor?.getPlatform?.() !== "web";
}

function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [nativeApp, setNativeApp] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  useEffect(() => {
    setNativeApp(isNativeAppRuntime());
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha precisa de no mínimo 6 caracteres.");
    setBusy(true);
    const fn = mode === "login" ? signIn : signUp;
    const { error } = await fn(email.trim(), password).finally(() => setBusy(false));
    if (error) return toast.error(error);
    if (mode === "signup") toast.success("Conta criada! Verifique seu e-mail para confirmar.");
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "var(--gradient-soft)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="mx-auto grid place-items-center w-16 h-16 rounded-3xl text-white shadow-lg mb-4"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Wallet size={32} strokeWidth={2.4} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Contas Fácil</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gestão de contas e vencimentos — suas contas organizadas em um só lugar
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-card rounded-3xl p-6 shadow-[var(--shadow-card)] space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="voce@exemplo.com"
              className="mt-1.5 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Mínimo 6 caracteres"
              className="mt-1.5 h-11 rounded-xl"
            />
          </div>
          <Button
            type="submit" disabled={busy}
            className="w-full h-11 rounded-xl text-base font-semibold"
            style={{ background: "var(--gradient-primary)" }}
          >
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>

          {!nativeApp ? (
            <>
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
                className="w-full h-11 rounded-xl font-semibold"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  }).finally(() => setBusy(false));
                  if (result.error) toast.error(result.error.message || "Falha ao entrar com Google");
                }}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Entrar com Google
              </Button>
            </>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              No app Android, use e-mail e senha. O Google fica disponível na versão web.
            </p>
          )}



          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "login"
              ? "Não tem conta? Cadastre-se"
              : "Já tem conta? Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
