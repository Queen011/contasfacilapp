import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { useCategorias, type Categoria } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { CategoriaIcone } from "@/components/CategoriaIcone";
import { EmojiPicker } from "@/components/EmojiPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

      {edit && user && (
        <CategoriaDialog
          state={edit}
          userId={user.id}
          onClose={() => setEdit(null)}
        />
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
  const [nome, setNome] = useState(cat?.nome ?? "");
  const [emoji, setEmoji] = useState(cat?.icone ?? "🏷️");
  const [cor, setCor] = useState(cat?.cor ?? "#10b981");
  const [busy, setBusy] = useState(false);

  const salvar = async () => {
    const n = nome.trim();
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{cat ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Academia" maxLength={40} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Emoji</label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
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
            <CategoriaIcone nome={nome || "Prévia"} cor={cor} icone={emoji} size={22} />
            <span className="font-semibold text-sm">{nome || "Prévia"}</span>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={busy}>
            <X size={16} /> Cancelar
          </Button>
          <Button onClick={salvar} className="flex-1" disabled={busy}>
            <Check size={16} /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
