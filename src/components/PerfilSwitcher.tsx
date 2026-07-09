import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users } from "lucide-react";
import { usePerfis, useActivePerfilId } from "@/lib/perfis";

export function PerfilSwitcher() {
  const { data: perfis = [] } = usePerfis();
  const [activeId, setActive] = useActivePerfilId();

  const ativo = useMemo(
    () => perfis.find((p) => p.id === activeId) ?? null,
    [perfis, activeId],
  );

  if (perfis.length === 0) {
    return (
      <Link
        to="/perfis"
        className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary"
      >
        <Users size={14} /> Criar perfis
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={activeId ?? ""}
        onChange={(e) => setActive(e.target.value || null)}
        className="rounded-full bg-card border border-border pl-2 pr-6 py-1 text-xs font-semibold max-w-[140px] truncate"
        aria-label="Perfil ativo"
      >
        <option value="">Nenhum perfil</option>
        {perfis.map((p) => (
          <option key={p.id} value={p.id}>
            {p.emoji} {p.nome}
          </option>
        ))}
      </select>
      <Link
        to="/perfis"
        className="grid place-items-center size-7 rounded-full bg-card border border-border shrink-0"
        aria-label="Gerenciar perfis"
        style={ativo ? { borderColor: ativo.cor } : undefined}
      >
        <Users size={14} />
      </Link>
    </div>
  );
}
