import { createFileRoute } from "@tanstack/react-router";
import { useContas } from "@/lib/queries";
import { ContaCard } from "@/components/ContaCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/finance";

export const Route = createFileRoute("/_app/pagas")({
  component: Pagas,
  head: () => ({
    meta: [
      { title: "Histórico de Pagamentos — Contas Fácil" },
      { name: "description", content: "Consulte todas as contas pagas e quitadas, com totais por período no Contas Fácil." },
      { property: "og:title", content: "Histórico de Pagamentos — Contas Fácil" },
      { property: "og:description", content: "Consulte todas as contas pagas e quitadas, com totais por período no Contas Fácil." },
    ],
  }),
});

function Pagas() {
  const { data: contas = [], isLoading } = useContas();
  const pagas = contas.filter((c) => c.status === "paga");
  const quitadas = contas.filter((c) => c.status === "quitada");
  const totalPagas = pagas.reduce((s, c) => s + Number(c.valor), 0);

  return (
    <div className="pad-fluid-x pt-6">
      <h1 className="text-fluid-2xl font-bold mb-4">Histórico</h1>
      <Tabs defaultValue="pagas">
        <TabsList className="grid grid-cols-2 w-full h-11 rounded-2xl mb-4">
          <TabsTrigger value="pagas" className="rounded-xl">Pagas ({pagas.length})</TabsTrigger>
          <TabsTrigger value="quitadas" className="rounded-xl">Quitadas ({quitadas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pagas" className="space-y-2.5">
          <p className="text-sm text-muted-foreground mb-1">
            Total: <span className="font-semibold text-success">{formatBRL(totalPagas)}</span>
          </p>
          {isLoading ? <p>Carregando…</p> :
           pagas.length === 0 ? <EmptyState msg="Nenhum pagamento registrado ainda." /> :
           pagas.map((c) => <ContaCard key={c.id} conta={c} />)}
        </TabsContent>

        <TabsContent value="quitadas" className="space-y-2.5">
          {quitadas.length === 0
            ? <EmptyState msg="Nenhuma conta quitada." />
            : quitadas.map((c) => <ContaCard key={c.id} conta={c} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="bg-card rounded-2xl p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
