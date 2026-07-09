import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { useCategorias, type Categoria } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { CategoriaIcone } from "@/components/CategoriaIcone";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/categorias")({
  component: CategoriasPage,
  head: () => ({
    meta: [
      { title: "Categorias — Contas Fácil" },
      { name: "description", content: "Crie, edite e exclua categorias de contas com emoji e cor personalizada." },
    ],
  }),
});

const CORES_SUGERIDAS = [
  "#10b981","#059669","#0f766e","#0ea5e9","#3b82f6","#6366f1",
  "#8b5cf6","#ec4899","#f43f5e","#ef4444","#f97316","#f59e0b",
  "#eab308","#84cc16","#a16207","#64748b",
];
const EMOJIS_CATEGORIA = ["🏷️", "💡", "📶", "💧", "🔥", "💳", "🧾", "🚗", "🏠", "📺", "🛒", "🍔", "💊", "🎓", "🐶", "⭐"];
const fieldClass = "w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

type EditState = { modo: "criar" } | { modo: "editar"; cat: Categoria } | null;

function CategoriasPage() {
  const { user } = useAuth();
  const { data: categorias = [], isLoading } = useCategorias();
  const [edit, setEdit] = useState<EditState>(null);
  const qc = useQueryClient();

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["contas"] });
      toast.success("Categoria excluída.");
    },
    onError: (e: Error) => toast.error(e.message.includes("foreign") ? "Existem contas usando essa categoria." : e.message),
  });

  return (
    <div className="pad-fluid-x pt-6 pb-24">
      <header className="flex items-center gap-3 mb-5 min-w-0">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link to="/"><ArrowLeft size={20} /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-fluid-2xl font-bold truncate">Categorias</h1>
          <p className="text-fluid-sm text-muted-foreground truncate">Personalize seus grupos de contas</p>
        </div>
        <Button size="sm" onClick={() => setEdit({ modo: "criar" })} className="shrink-0">
          <Plus size={16} /> Nova
        </Button>
      </header>

      {edit && user && (
        <CategoriaDialog
          state={edit}
          userId={user.id}
          onClose={() => setEdit(null)}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="space-y-2">
          {categorias.map((cat) => (
            <li key={cat.id} className="flex items-center gap-3 bg-card rounded-2xl p-3 shadow-[var(--shadow-card)]">
              <CategoriaIcone nome={cat.nome} cor={cat.cor} icone={cat.icone} size={20} />
              <span className="flex-1 font-semibold text-sm truncate">{cat.nome}</span>
              <button onClick={() => setEdit({ modo: "editar", cat })} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Editar">
                <Pencil size={16} />
              </button>
              <button
                onClick={() => { if (confirm(`Excluir "${cat.nome}"?`)) excluir.mutate(cat.id); }}
                className="p-2 text-destructive"
                aria-label="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}

function CategoriaDialog({
  state,
  userId,
  onClose,
}: {
  state: Exclude<EditState, null>;
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const cat = state.modo === "editar" ? state.cat : null;
  const nomeRef = useRef<HTMLInputElement>(null);
  const [emoji, setEmoji] = useState(cat?.icone ?? "🏷️");
  const [cor, setCor] = useState(cat?.cor ?? "#10b981");
  const [busy, setBusy] = useState(false);

  const salvar = async () => {
    const n = nomeRef.current?.value.trim() ?? "";
    if (!n) return toast.error("Informe o nome.");
    setBusy(true);
    const payload = { nome: n, icone: emoji || "🏷️", cor };
    const { error } = cat
      ? await supabase.from("categorias").update(payload).eq("id", cat.id)
      : await supabase.from("categorias").insert({ ...payload, user_id: userId });
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["categorias"] });
    qc.invalidateQueries({ queryKey: ["contas"] });
    toast.success(cat ? "Categoria atualizada." : "Categoria criada.");
    onClose();
  };

  return (
    <section className="mb-5 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] border border-border">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold truncate">{cat ? "Editar categoria" : "Nova categoria"}</h2>
        <Button type="button" variant="ghost" size="icon" aria-label="Cancelar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Nome</label>
            <input ref={nomeRef} name="nome" type="text" defaultValue={cat?.nome ?? ""} placeholder="Ex: Academia" maxLength={40} enterKeyHint="done" className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Emoji</label>
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJIS_CATEGORIA.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`h-10 w-full rounded-xl text-xl grid place-items-center border transition ${emoji === e ? "border-primary bg-secondary" : "border-border bg-card"}`}
                  aria-label={`Escolher ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Cor</label>
            <div className="grid grid-cols-8 gap-1.5">
              {CORES_SUGERIDAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={`h-10 rounded-xl border-2 transition ${cor === c ? "border-foreground scale-95" : "border-transparent"}`}
                  style={{ background: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
            <CategoriaIcone nome={cat?.nome || "Prévia"} cor={cor} icone={emoji} size={22} />
            <span className="font-semibold text-sm">{cat?.nome || "Prévia"}</span>
          </div>
        </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          <X size={16} /> Cancelar
        </Button>
        <Button onClick={salvar} disabled={busy}>
          <Check size={16} /> Salvar
        </Button>
      </div>
    </section>
  );
}
