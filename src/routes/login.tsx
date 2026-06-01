import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
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
    if (password.length < 6) return toast.error("A senha precisa de no mínimo 6 caracteres.");
    setBusy(true);
    const fn = mode === "login" ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) return toast.error(error);
    if (mode === "signup") toast.success("Conta criada! Verifique seu e-mail para confirmar.");
  };

  return (
    <div
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
          <h1 className="text-2xl font-bold">Controle Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suas contas organizadas em um só lugar
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-card rounded-3xl p-6 shadow-[var(--shadow-card)] space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="mt-1.5 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
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
    </div>
  );
}
