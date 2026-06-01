import { Link } from "@tanstack/react-router";
import { CategoriaIcone } from "@/components/CategoriaIcone";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/finance";
import type { Conta } from "@/lib/queries";

const statusStyles: Record<Conta["status"], string> = {
  pendente: "bg-warning/15 text-warning-foreground/80 border-warning/30",
  paga: "bg-success/15 text-success border-success/30",
  atrasada: "bg-destructive/15 text-destructive border-destructive/40",
  quitada: "bg-primary/10 text-primary border-primary/30",
};

const statusLabel: Record<Conta["status"], string> = {
  pendente: "Pendente", paga: "Paga", atrasada: "Atrasada", quitada: "Quitada",
};

export function ContaCard({ conta }: { conta: Conta }) {
  const cor = conta.categoria?.cor ?? "#10b981";
  const nomeCat = conta.categoria?.nome ?? "Outros";
  return (
    <Link
      to="/conta/$id" params={{ id: conta.id }}
      className="flex items-center gap-3 bg-card rounded-2xl p-3.5 shadow-[var(--shadow-card)] active:scale-[0.99] transition"
    >
      <CategoriaIcone nome={nomeCat} cor={cor} size={22} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold truncate">{conta.nome}</p>
          <p className="font-bold tabular-nums">{formatBRL(conta.valor)}</p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Vence {formatDate(conta.vencimento)}
          </p>
          <Badge variant="outline" className={`text-[10px] rounded-full px-2 py-0 h-5 ${statusStyles[conta.status]}`}>
            {statusLabel[conta.status]}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
