import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  usePerfis,
  useCreatePerfil,
  useDeletePerfil,
  useActivePerfilId,
} from "@/lib/perfis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/perfis")({
  component: PerfisPage,
  head: () => ({
    meta: [
      { title: "Perfis — Contas Fácil" },
      { name: "description", content: "Crie perfis para compartilhar a conta com família ou parceiro(a)." },
    ],
  }),
});

const EMOJIS = ["👤", "👩", "👨", "🧑", "👧", "👦", "👵", "👴", "🐶", "🐱", "⭐", "❤️"];
const CORES = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444"];

function PerfisPage() {
  const { user } = useAuth();
  const { data: perfis = [] } = usePerfis();
  const create = useCreatePerfil(user?.id);
  const del = useDeletePerfil();
  const [activeId, setActive] = useActivePerfilId();

  const [nome, setNome] = useState("");
  const [emoji, setEmoji] = useState("👤");
  const [cor, setCor] = useState("#10b981");

  const salvar = () => {
    if (!nome.trim()) {
      toast.warning("Digite um nome.");
      return;
    }
    create.mutate(
      { nome, emoji, cor },
      {
        onSuccess: (p) => {
          toast.success(`Perfil ${p.nome} criado.`);
          setNome("");
          if (!activeId) setActive(p.id);
        },
        onError: () => toast.error("Não foi possível criar."),
      },
    );
  };

  const remover = (id: string, nome: string) => {
    if (!confirm(`Excluir o perfil ${nome}?`)) return;
    del.mutate(id, {
      onSuccess: () => {
        if (activeId === id) setActive(null);
        toast.success("Perfil excluído.");
      },
    });
  };

  return (
    <div className="pad-fluid-x pt-6 pb-4">
      <header className="flex items-center gap-2 mb-5">
        <Link
          to="/"
          className="grid place-items-center size-10 rounded-2xl bg-card border border-border shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-fluid-xl font-bold flex items-center gap-2">
            <Users size={20} /> Perfis
          </h1>
          <p className="text-fluid-xs text-muted-foreground">
            Compartilhe a conta com família. Todos veem os mesmos dados.
          </p>
        </div>
      </header>

      <section className="bg-card border border-border rounded-2xl p-4 mb-5">
        <h2 className="text-sm font-bold mb-3">Novo perfil</h2>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Maria, João, Casa"
          className="mb-3"
          maxLength={30}
        />
        <div className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Emoji</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`size-9 rounded-xl text-lg grid place-items-center border ${
                  emoji === e ? "border-primary bg-secondary" : "border-border bg-card"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Cor</p>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                className={`size-8 rounded-full border-2 ${cor === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <Button onClick={salvar} disabled={create.isPending} className="w-full">
          <Plus size={16} /> Adicionar perfil
        </Button>
      </section>

      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase mb-3">
          Perfis criados ({perfis.length})
        </h2>
        {perfis.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Nenhum perfil ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {perfis.map((p) => {
              const ativo = p.id === activeId;
              return (
                <li
                  key={p.id}
                  className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
                  style={ativo ? { borderColor: p.cor } : undefined}
                >
                  <span
                    className="size-11 rounded-2xl grid place-items-center text-xl shrink-0"
                    style={{ background: p.cor + "22" }}
                  >
                    {p.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.nome}</p>
                    {ativo && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <Check size={12} /> Ativo
                      </p>
                    )}
                  </div>
                  {!ativo && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActive(p.id)}
                    >
                      Usar
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remover(p.id, p.nome)}
                    aria-label="Excluir"
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
