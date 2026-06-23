import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { iconeContasFacilUrl } from "@/lib/app-assets";

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

function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpo = email.trim();
    if (!emailLimpo) return toast.error("Informe seu e-mail.");
    if (!emailLimpo.includes("@")) return toast.error("Informe um e-mail válido.");
    if (password.length < 6) return toast.error("A senha precisa de no mínimo 6 caracteres.");
    setBusy(true);
    const fn = mode === "login" ? signIn : signUp;
    const { error } = await fn(emailLimpo, password).finally(() => setBusy(false));
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

        <form onSubmit={onSubmit} noValidate className="bg-card rounded-3xl p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="grid grid-cols-2 rounded-2xl bg-secondary p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`h-10 rounded-xl text-sm font-semibold transition ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`h-10 rounded-xl text-sm font-semibold transition ${
                mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
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
        </form>
      </div>
    </main>
  );
}
