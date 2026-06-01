import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useCategorias } from "@/lib/queries";
import { CategoriaIcone } from "@/components/CategoriaIcone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Recorrencia } from "@/lib/finance";

export const Route = createFileRoute("/_app/nova")({
  component: NovaConta,
  head: () => ({
    meta: [
      { title: "Nova Conta — Cadastrar despesa | Contas Fácil" },
      { name: "description", content: "Cadastre uma nova conta avulsa ou recorrente, com categoria, valor e data de vencimento." },
      { property: "og:title", content: "Nova Conta — Cadastrar despesa | Contas Fácil" },
      { property: "og:description", content: "Cadastre uma nova conta avulsa ou recorrente, com categoria, valor e data de vencimento." },
    ],
  }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function NovaConta() {
  const { user } = useAuth();
  const { data: categorias = [] } = useCategorias();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("mensal");
  const [meses, setMeses] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleMes = (m: number) =>
    setMeses((arr) => arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m].sort((a,b)=>a-b));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!categoriaId) return toast.error("Escolha uma categoria.");
    const val = Number(valor.replace(",", "."));
    if (isNaN(val) || val <= 0) return toast.error("Informe um valor válido.");
    if (recorrente && recorrencia === "personalizada" && meses.length === 0)
      return toast.error("Selecione ao menos um mês.");

    setBusy(true);
    const { error } = await supabase.from("contas").insert({
      user_id: user.id,
      nome: nome.trim(),
      valor: val,
      vencimento,
      categoria_id: categoriaId,
      observacoes: observacoes.trim() || null,
      tipo: recorrente ? "recorrente" : "avulsa",
      recorrencia: recorrente ? recorrencia : null,
      meses_personalizados: recorrente && recorrencia === "personalizada" ? meses : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada!");
    qc.invalidateQueries({ queryKey: ["contas"] });
    navigate({ to: "/pendentes" });
  };

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-bold">Nova conta</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required
                 placeholder="Ex: Cemig - Luz" className="mt-1.5 h-11 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input id="valor" value={valor} onChange={(e) => setValor(e.target.value)}
                   inputMode="decimal" required placeholder="0,00"
                   className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="vencimento">Vencimento</Label>
            <Input id="vencimento" type="date" value={vencimento} required
                   onChange={(e) => setVencimento(e.target.value)}
                   className="mt-1.5 h-11 rounded-xl" />
          </div>
        </div>

        <div>
          <Label>Categoria</Label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {categorias.map((c) => {
              const active = c.id === categoriaId;
              return (
                <button
                  type="button" key={c.id}
                  onClick={() => setCategoriaId(c.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition ${
                    active ? "border-primary bg-primary/5" : "border-transparent bg-card"
                  }`}
                >
                  <CategoriaIcone nome={c.icone} cor={c.cor} size={18} />
                  <span className="text-[10px] font-medium leading-tight text-center">{c.nome}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Conta recorrente</Label>
              <p className="text-xs text-muted-foreground">Gera próximas parcelas automaticamente</p>
            </div>
            <Switch checked={recorrente} onCheckedChange={setRecorrente} />
          </div>

          {recorrente && (
            <>
              <div>
                <Label>Frequência</Label>
                <Select value={recorrencia} onValueChange={(v) => setRecorrencia(v as Recorrencia)}>
                  <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="bimestral">Bimestral</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual (ex: IPVA 1x)</SelectItem>
                    <SelectItem value="personalizada">Personalizada (escolher meses)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recorrencia === "personalizada" && (
                <div>
                  <Label>Meses do ano</Label>
                  <div className="mt-2 grid grid-cols-6 gap-1.5">
                    {MESES.map((m, i) => {
                      const num = i + 1;
                      const on = meses.includes(num);
                      return (
                        <button type="button" key={num} onClick={() => toggleMes(num)}
                          className={`h-9 rounded-lg text-xs font-medium border-2 ${
                            on ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"
                          }`}>
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                    className="mt-1.5 rounded-xl" rows={2} />
        </div>

        <Button type="submit" disabled={busy}
                className="w-full h-12 rounded-xl text-base font-semibold"
                style={{ background: "var(--gradient-primary)" }}>
          {busy ? "Salvando..." : "Salvar conta"}
        </Button>
      </form>
    </div>
  );
}
