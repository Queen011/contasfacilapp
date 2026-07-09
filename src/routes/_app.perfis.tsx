import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Trash2, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  usePerfis,
  useCreatePerfil,
  useDeletePerfil,
  useActivePerfilId,
} from "@/lib/perfis";
import { Button } from "@/components/ui/button";

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
type PerfilFrameSubmit = { nome: string; emoji: string; cor: string };
type PerfilFrameMessage =
  | { source: "contasfacil-perfil-frame"; type: "submit"; payload: PerfilFrameSubmit }
  | { source: "contasfacil-perfil-frame"; type: "height"; height: number };

function PerfisPage() {
  const { user } = useAuth();
  const { data: perfis = [] } = usePerfis();
  const create = useCreatePerfil(user?.id);
  const del = useDeletePerfil();
  const [activeId, setActive] = useActivePerfilId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(470);
  const frameHtml = useMemo(() => buildPerfilFrameHtml(), []);

  const postToFrame = (message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ source: "contasfacil-perfil-parent", ...message }, "*");
  };

  const salvar = (payload: PerfilFrameSubmit) => {
    const nome = payload.nome.trim();
    if (!nome) {
      toast.warning("Digite um nome.");
      return;
    }
    create.mutate(
      { nome, emoji: payload.emoji, cor: payload.cor },
      {
        onSuccess: (p) => {
          toast.success(`Perfil ${p.nome} criado.`);
          postToFrame({ type: "reset" });
          if (!activeId) setActive(p.id);
        },
        onError: () => toast.error("Não foi possível criar."),
      },
    );
  };

  useEffect(() => {
    postToFrame({ type: "busy", busy: create.isPending });
  }, [create.isPending]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<PerfilFrameMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "contasfacil-perfil-frame") return;
      if (data.type === "height") setIframeHeight(Math.max(390, Math.min(760, data.height)));
      if (data.type === "submit") salvar(data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [activeId, create.isPending]);

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
        <iframe
          ref={iframeRef}
          title="Novo perfil"
          srcDoc={frameHtml}
          className="block w-full bg-transparent"
          style={{ height: iframeHeight, border: 0 }}
          sandbox="allow-scripts allow-forms allow-same-origin"
          aria-busy={create.isPending}
        />
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

function buildPerfilFrameHtml() {
  const emojis = JSON.stringify(EMOJIS);
  const cores = JSON.stringify(CORES);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <style>
    :root{color-scheme:only light;--card:#ffffff;--text:#123033;--muted:#667a7b;--border:#dbecea;--primary:#12b981;--secondary:#e8f8f3;--shadow-card:0 2px 12px -2px rgba(10,120,100,.14);font-family:"Plus Jakarta Sans",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;background:transparent;color:var(--text);font-family:inherit}body{overflow:hidden}button,input{font:inherit;font-size:16px}button{border:0;cursor:pointer;touch-action:manipulation}input{width:100%;min-height:48px;border:1px solid var(--border);border-radius:18px;background:#fff!important;color:#111827!important;-webkit-text-fill-color:#111827!important;caret-color:#111827!important;padding:0 16px;outline:none;line-height:normal;opacity:1!important;user-select:text;-webkit-user-select:text;box-shadow:var(--shadow-card)}input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(18,185,129,.18),var(--shadow-card)}input::placeholder{color:#6b7280;-webkit-text-fill-color:#6b7280;opacity:1}.stack{display:grid;gap:16px}.field{display:grid;gap:8px}.label,label{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.emojiGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.emoji{height:40px;border-radius:12px;background:#fff;border:1px solid var(--border);font-size:20px}.emoji.active{background:var(--secondary);border:2px solid var(--primary)}.colorGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.color{height:38px;border-radius:14px;border:2px solid transparent}.color.active{border-color:#123033;transform:scale(.95)}.preview{display:flex;align-items:center;gap:12px;border-radius:18px;background:var(--secondary);padding:12px;font-weight:800;font-size:14px}.previewIcon{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;font-size:22px}.save{width:100%;min-height:50px;border-radius:16px;background:linear-gradient(135deg,#2dd4bf 0%,#10b981 100%);color:#fff;font-weight:900}.save:disabled{opacity:.7}
  </style>
</head>
<body>
  <form id="form" class="stack" novalidate>
    <div class="field"><label for="nome">Nome</label><input id="nome" name="nome" type="text" placeholder="Ex.: Maria, João, Casa" maxlength="30" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" /></div>
    <div><p class="label">Emoji</p><div id="emojis" class="emojiGrid"></div></div>
    <div><p class="label">Cor</p><div id="cores" class="colorGrid"></div></div>
    <div class="preview"><span id="previewIcon" class="previewIcon"></span><span id="previewName">Prévia</span></div>
    <button id="saveBtn" type="submit" class="save">+ Adicionar perfil</button>
  </form>
  <script>
    const SOURCE='contasfacil-perfil-frame';const emojis=${emojis};const cores=${cores};let emoji='👤';let cor='#10b981';let busy=false;const $=(id)=>document.getElementById(id);const post=(message)=>parent.postMessage({source:SOURCE,...message},'*');const reportHeight=()=>post({type:'height',height:document.documentElement.scrollHeight+8});
    function escapeHtml(value){return String(value).replace(/[&<>'"]/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
    function render(){ $('emojis').innerHTML=emojis.map((e)=>'<button type="button" class="emoji '+(e===emoji?'active':'')+'" data-emoji="'+escapeHtml(e)+'">'+e+'</button>').join('');$('cores').innerHTML=cores.map((c)=>'<button type="button" class="color '+(c===cor?'active':'')+'" data-cor="'+c+'" style="background:'+c+'" aria-label="'+c+'"></button>').join('');$('previewIcon').textContent=emoji;$('previewIcon').style.background=cor+'22';$('previewName').textContent=$('nome').value.trim()||'Prévia';document.querySelectorAll('.emoji').forEach((btn)=>btn.addEventListener('click',()=>{emoji=btn.dataset.emoji||'👤';render()}));document.querySelectorAll('.color').forEach((btn)=>btn.addEventListener('click',()=>{cor=btn.dataset.cor||'#10b981';render()}));reportHeight()}
    function reset(){ $('nome').value='';emoji='👤';cor='#10b981';render();setTimeout(()=>$('nome').focus({preventScroll:false}),0)}
    function focusNative(target){if(!target||target.tagName!=='INPUT')return;setTimeout(()=>target.focus({preventScroll:false}),0)}
    document.addEventListener('pointerup',(event)=>focusNative(event.target),true);document.addEventListener('touchend',(event)=>focusNative(event.target),true);$('nome').addEventListener('input',render);$('form').addEventListener('submit',(event)=>{event.preventDefault();if(busy)return;post({type:'submit',payload:{nome:$('nome').value,emoji,cor}})});window.addEventListener('message',(event)=>{const data=event.data||{};if(data.source!=='contasfacil-perfil-parent')return;if(data.type==='busy'){busy=Boolean(data.busy);$('saveBtn').disabled=busy;$('saveBtn').textContent=busy?'Salvando...':'+ Adicionar perfil';$('nome').disabled=busy}if(data.type==='reset')reset()});render();
  </script>
</body>
</html>`;
}
