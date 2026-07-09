import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { useCategorias, type Categoria } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { CategoriaIcone } from "@/components/CategoriaIcone";
import { Button } from "@/components/ui/button";
import { EMOJIS_SUGERIDOS } from "@/lib/categoria-emoji";

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
type CategoriaFrameSubmit = { nome: string; emoji: string; cor: string };
type CategoriaFrameMessage =
  | { source: "contasfacil-categoria-frame"; type: "submit"; payload: CategoriaFrameSubmit }
  | { source: "contasfacil-categoria-frame"; type: "cancel" }
  | { source: "contasfacil-categoria-frame"; type: "height"; height: number };

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(420);
  const [busy, setBusy] = useState(false);
  const frameHtml = useMemo(() => buildCategoriaFrameHtml(cat), [cat]);

  const setFrameBusy = (value: boolean) => {
    setBusy(value);
    iframeRef.current?.contentWindow?.postMessage({ source: "contasfacil-categoria-parent", type: "busy", busy: value }, "*");
  };

  const salvar = async (payload: CategoriaFrameSubmit) => {
    const n = payload.nome.trim();
    if (!n) return toast.error("Informe o nome.");
    setFrameBusy(true);
    const dados = { nome: n, icone: payload.emoji || "🏷️", cor: payload.cor || "#10b981" };
    const { error } = cat
      ? await supabase.from("categorias").update(dados).eq("id", cat.id)
      : await supabase.from("categorias").insert({ ...dados, user_id: userId });
    setFrameBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["categorias"] });
    qc.invalidateQueries({ queryKey: ["contas"] });
    toast.success(cat ? "Categoria atualizada." : "Categoria criada.");
    onClose();
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent<CategoriaFrameMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "contasfacil-categoria-frame") return;
      if (data.type === "height") setIframeHeight(Math.max(360, Math.min(900, data.height)));
      if (data.type === "cancel") onClose();
      if (data.type === "submit") salvar(data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [cat, busy]);

  return (
    <section className="mb-5 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] border border-border">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold truncate">{cat ? "Editar categoria" : "Nova categoria"}</h2>
        <Button type="button" variant="ghost" size="icon" aria-label="Cancelar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        title={cat ? "Editar categoria" : "Nova categoria"}
        srcDoc={frameHtml}
        className="block w-full bg-transparent"
        style={{ height: iframeHeight, border: 0 }}
        sandbox="allow-scripts allow-forms allow-same-origin"
        aria-busy={busy}
      />
    </section>
  );
}

function buildCategoriaFrameHtml(cat: Categoria | null) {
  const initial = JSON.stringify({ nome: cat?.nome ?? "", emoji: cat?.icone ?? "🏷️", cor: cat?.cor ?? "#10b981" }).replace(/</g, "\\u003c");
  const cores = JSON.stringify(CORES_SUGERIDAS);
  const emojis = JSON.stringify(EMOJIS_SUGERIDOS);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <style>
    :root{color-scheme:only light;--card:#ffffff;--text:#123033;--muted:#667a7b;--border:#dbecea;--primary:#12b981;--secondary:#e8f8f3;--shadow-card:0 2px 12px -2px rgba(10,120,100,.14);font-family:"Plus Jakarta Sans",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;background:transparent;color:var(--text);font-family:inherit}body{overflow:hidden}button,input{font:inherit;font-size:16px}button{border:0;cursor:pointer;touch-action:manipulation}input{width:100%;min-height:48px;border:1px solid var(--border);border-radius:18px;background:#fff!important;color:#111827!important;-webkit-text-fill-color:#111827!important;caret-color:#111827!important;padding:0 16px;outline:none;line-height:normal;opacity:1!important;user-select:text;-webkit-user-select:text;box-shadow:var(--shadow-card)}input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(18,185,129,.18),var(--shadow-card)}input::placeholder{color:#6b7280;-webkit-text-fill-color:#6b7280;opacity:1}.stack{display:grid;gap:16px}.field{display:grid;gap:8px}.label,label{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.emojiGrid,.colorGrid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px}.emoji{height:40px;border-radius:12px;background:#fff;border:1px solid var(--border);font-size:20px}.emoji.active{background:var(--secondary);border:2px solid var(--primary)}.color{height:40px;border-radius:12px;border:2px solid transparent}.color.active{border-color:#123033;transform:scale(.95)}.preview{display:flex;align-items:center;gap:12px;border-radius:18px;background:var(--secondary);padding:12px;font-weight:700;font-size:14px}.previewIcon{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;font-size:22px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.btn{min-height:44px;border-radius:14px;font-weight:800}.outline{background:#fff;color:var(--text);border:1px solid var(--border)}.save{background:linear-gradient(135deg,#2dd4bf 0%,#10b981 100%);color:#fff}.btn:disabled{opacity:.7}
  </style>
</head>
<body>
  <form id="form" class="stack" novalidate>
    <div class="field"><label for="nome">Nome</label><input id="nome" name="nome" type="text" value="" placeholder="Ex: Academia" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" /></div>
    <div><p class="label">Emoji</p><div id="emojis" class="emojiGrid"></div></div>
    <div><p class="label">Cor</p><div id="cores" class="colorGrid"></div></div>
    <div class="preview"><span id="previewIcon" class="previewIcon"></span><span id="previewName">Prévia</span></div>
    <div class="actions"><button id="cancelBtn" type="button" class="btn outline">✕ Cancelar</button><button id="saveBtn" type="submit" class="btn save">✓ Salvar</button></div>
  </form>
  <script>
    const SOURCE='contasfacil-categoria-frame';const initial=${initial};const emojis=${emojis};const cores=${cores};let emoji=initial.emoji||'🏷️';let cor=initial.cor||'#10b981';let busy=false;const $=(id)=>document.getElementById(id);const post=(message)=>parent.postMessage({source:SOURCE,...message},'*');const reportHeight=()=>post({type:'height',height:document.documentElement.scrollHeight+8});
    $('nome').value=initial.nome||'';function escapeHtml(value){return String(value).replace(/[&<>'"]/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}function render(){ $('emojis').innerHTML=emojis.map((e)=>'<button type="button" class="emoji '+(e===emoji?'active':'')+'" data-emoji="'+escapeHtml(e)+'">'+e+'</button>').join('');$('cores').innerHTML=cores.map((c)=>'<button type="button" class="color '+(c===cor?'active':'')+'" data-cor="'+c+'" style="background:'+c+'"></button>').join('');$('previewIcon').textContent=emoji;$('previewIcon').style.background=cor+'1f';$('previewIcon').style.color=cor;$('previewName').textContent=$('nome').value.trim()||'Prévia';document.querySelectorAll('.emoji').forEach((btn)=>btn.addEventListener('click',()=>{emoji=btn.dataset.emoji||'🏷️';render()}));document.querySelectorAll('.color').forEach((btn)=>btn.addEventListener('click',()=>{cor=btn.dataset.cor||'#10b981';render()}));reportHeight()}
    function focusNative(target){if(!target||target.tagName!=='INPUT')return;setTimeout(()=>target.focus({preventScroll:false}),0)}document.addEventListener('pointerup',(event)=>focusNative(event.target),true);document.addEventListener('touchend',(event)=>focusNative(event.target),true);$('nome').addEventListener('input',render);$('cancelBtn').addEventListener('click',()=>post({type:'cancel'}));$('form').addEventListener('submit',(event)=>{event.preventDefault();if(busy)return;post({type:'submit',payload:{nome:$('nome').value,emoji,cor}})});window.addEventListener('message',(event)=>{const data=event.data||{};if(data.source!=='contasfacil-categoria-parent')return;if(data.type==='busy'){busy=Boolean(data.busy);$('saveBtn').disabled=busy;$('saveBtn').textContent=busy?'Salvando...':'✓ Salvar'}});new ResizeObserver(reportHeight).observe(document.body);render();
  </script>
</body>
</html>`;
}
