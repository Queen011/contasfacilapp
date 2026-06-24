import { createFileRoute } from "@tanstack/react-router";
import { useContas } from "@/lib/queries";
import { ContaCard } from "@/components/ContaCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/finance";

export const Route = createFileRoute("/_app/pendentes")({
  component: Pendentes,
  head: () => ({
    meta: [
      { title: "Contas a Pagar — Pendentes e Atrasadas" },
      { name: "description", content: "Acompanhe contas pendentes e atrasadas, com totais e datas de vencimento no Contas Fácil." },
      { property: "og:title", content: "Contas a Pagar — Pendentes e Atrasadas" },
      { property: "og:description", content: "Acompanhe contas pendentes e atrasadas, com totais e datas de vencimento no Contas Fácil." },
    ],
  }),
});

function Pendentes() {
  const { data: contas = [], isLoading } = useContas();
  const pendentes = contas.filter((c) => c.status === "pendente");
  const atrasadas = contas.filter((c) => c.status === "atrasada");
  const totalPend = pendentes.reduce((s, c) => s + Number(c.valor), 0);
  const totalAtr = atrasadas.reduce((s, c) => s + Number(c.valor), 0);

  return (
    <div className="pad-fluid-x pt-6">
      <h1 className="text-fluid-2xl font-bold mb-4">A pagar</h1>
      <Tabs defaultValue={atrasadas.length > 0 ? "atrasadas" : "pendentes"}>
        <TabsList className="grid grid-cols-2 w-full h-11 rounded-2xl mb-4">
          <TabsTrigger value="pendentes" className="rounded-xl">
            Pendentes ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="atrasadas" className="rounded-xl data-[state=active]:text-destructive">
            Atrasadas ({atrasadas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-2.5">
          <p className="text-sm text-muted-foreground mb-1">
            Total: <span className="font-semibold text-foreground">{formatBRL(totalPend)}</span>
          </p>
          {isLoading ? <p>Carregando…</p> :
           pendentes.length === 0 ? <EmptyState msg="Sem contas pendentes." /> :
           pendentes.map((c) => <ContaCard key={c.id} conta={c} />)}
        </TabsContent>

        <TabsContent value="atrasadas" className="space-y-2.5">
          <p className="text-sm text-muted-foreground mb-1">
            Total: <span className="font-semibold text-destructive">{formatBRL(totalAtr)}</span>
          </p>
          {atrasadas.length === 0
            ? <EmptyState msg="Nenhuma conta atrasada. 🎉" />
            : atrasadas.map((c) => <ContaCard key={c.id} conta={c} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="bg-card rounded-2xl p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
