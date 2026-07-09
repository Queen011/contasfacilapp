import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Lock, Trash2, Calendar, FileText, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useContas, useCategorias, type Conta } from "@/lib/queries";
import { CategoriaIcone } from "@/components/CategoriaIcone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatBRL, formatDateFull, proximoVencimento } from "@/lib/finance";

export const Route = createFileRoute("/_app/conta/$id")({
  component: ContaDetalhe,
  head: () => ({
    meta: [
      { title: "Detalhes da conta — Contas Fácil" },
      { name: "description", content: "Veja, pague, quite ou exclua uma conta cadastrada no Contas Fácil." },
      { property: "og:title", content: "Detalhes da conta — Contas Fácil" },
      { property: "og:description", content: "Veja, pague, quite ou exclua uma conta cadastrada no Contas Fácil." },
    ],
  }),
});

type EditContaSubmit = {
  nome: string;
  valor: string;
  vencimento: string;
  categoriaId: string;
  observacoes: string;
};

type EditContaFrameMessage =
  | { source: "contasfacil-editar-conta-frame"; type: "submit"; payload: EditContaSubmit }
  | { source: "contasfacil-editar-conta-frame"; type: "cancel" }
  | { source: "contasfacil-editar-conta-frame"; type: "height"; height: number };

function ContaDetalhe() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: contas = [], isLoading } = useContas();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const conta = contas.find((c) => c.id === id);
  const [editando, setEditando] = useState(false);

  if (isLoading) return <div className="p-6">Carregando…</div>;
  if (!conta) return <div className="p-6">Conta não encontrada.</div>;

  const refresh = () => qc.invalidateQueries({ queryKey: ["contas"] });

  if (editando) {
    return (
      <EditarContaDialog
        conta={conta}
        onClose={() => setEditando(false)}
        onSaved={() => { setEditando(false); refresh(); }}
      />
    );
  }

  const marcarPaga = async () => {
    const { error } = await supabase
      .from("contas")
      .update({ status: "paga", pago_em: new Date().toISOString() })
      .eq("id", conta.id);
    if (error) return toast.error(error.message);

    if (conta.tipo === "recorrente" && conta.recorrencia && user) {
      const prox = proximoVencimento(conta.vencimento, conta.recorrencia, conta.meses_personalizados);
      await supabase.from("contas").insert({
        user_id: user.id,
        categoria_id: conta.categoria_id,
        nome: conta.nome,
        valor: conta.valor,
        vencimento: prox,
        observacoes: conta.observacoes,
        tipo: "recorrente",
        recorrencia: conta.recorrencia,
        meses_personalizados: conta.meses_personalizados,
        conta_pai_id: conta.conta_pai_id ?? conta.id,
      });
      toast.success("Marcada como paga. Próxima parcela criada!");
    } else {
      toast.success("Marcada como paga!");
    }
    refresh();
    navigate({ to: "/pagas" });
  };

  const quitar = async () => {
    const { error } = await supabase
      .from("contas")
      .update({ status: "quitada", pago_em: new Date().toISOString() })
      .eq("id", conta.id);
    if (error) return toast.error(error.message);
    toast.success("Conta quitada!");
    refresh();
    navigate({ to: "/pagas" });
  };

  const excluir = async () => {
    if (!confirm("Excluir esta conta?")) return;
    const { error } = await supabase.from("contas").delete().eq("id", conta.id);
    if (error) return toast.error(error.message);
    toast.success("Excluída.");
    refresh();
    navigate({ to: "/" });
  };

  const cor = conta.categoria?.cor ?? "#10b981";
  const podeAgir = conta.status === "pendente" || conta.status === "atrasada";

  return (
    <div className="pad-fluid-x pt-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => history.back()}>
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditando(true)}>
            <Pencil size={18} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Excluir conta" onClick={excluir} className="text-destructive">
            <Trash2 size={20} />
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-3xl p-5 shadow-[var(--shadow-card)] text-center min-w-0">
        <div className="flex justify-center mb-3">
          <CategoriaIcone nome={conta.categoria?.nome ?? "Outros"} cor={cor} icone={conta.categoria?.icone} size={32} />
        </div>
        <p className="text-fluid-sm text-muted-foreground truncate">{conta.categoria?.nome}</p>
        <h1 className="text-fluid-xl font-bold mt-1 break-words">{conta.nome}</h1>
        <p className="text-fluid-3xl font-extrabold mt-3 tabular-nums break-words" style={{ color: cor }}>
          {formatBRL(conta.valor)}
        </p>
        <Badge className="mt-3 rounded-full" variant="outline">
          {conta.status.toUpperCase()}
        </Badge>
      </div>

      <div className="bg-card rounded-2xl p-4 mt-4 space-y-3">
        <Info icon={<Calendar size={16} />} label="Vencimento" value={formatDateFull(conta.vencimento)} />
        <Info icon={<FileText size={16} />} label="Tipo"
              value={conta.tipo === "recorrente" ? `Recorrente · ${conta.recorrencia}` : "Avulsa"} />
        {conta.pago_em && (
          <Info icon={<Check size={16} />} label="Pago em"
                value={new Date(conta.pago_em).toLocaleDateString("pt-BR")} />
        )}
        {conta.observacoes && (
          <div>
            <p className="text-fluid-xs text-muted-foreground mb-1">Observações</p>
            <p className="text-fluid-sm break-words">{conta.observacoes}</p>
          </div>
        )}
      </div>

      {podeAgir && (
        <div className="mt-5 space-y-2.5">
          <Button onClick={marcarPaga}
            className="w-full h-12 rounded-xl text-base font-semibold"
            style={{ background: "var(--gradient-primary)" }}>
            <Check size={18} /> Marcar como paga
          </Button>
          <Button onClick={quitar} variant="outline"
                  className="w-full h-12 rounded-xl text-base font-semibold">
            <Lock size={18} /> Quitar de vez (encerrar)
          </Button>
        </div>
      )}
    </div>
  );
}

function EditarContaDialog({
  conta,
  onClose,
  onSaved,
}: {
  conta: Conta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: categorias = [] } = useCategorias();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(620);
  const [busy, setBusy] = useState(false);
  const frameHtml = useMemo(() => buildEditarContaFrameHtml(conta, categorias), [conta, categorias]);

  const setFrameBusy = (value: boolean) => {
    setBusy(value);
    iframeRef.current?.contentWindow?.postMessage({ source: "contasfacil-editar-conta-parent", type: "busy", busy: value }, "*");
  };

  const salvar = async (payload: EditContaSubmit) => {
    if (busy) return;
    const n = payload.nome.trim();
    const v = Number(payload.valor.replace(/\./g, "").replace(",", "."));
    const vencimentoIso = payload.vencimento.trim();
    const categoriaId = payload.categoriaId.trim();
    const observacoes = payload.observacoes;
    if (!n) return toast.error("Informe o nome.");
    if (Number.isNaN(v) || v <= 0) return toast.error("Valor inválido.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimentoIso)) return toast.error("Informe o vencimento.");
    setFrameBusy(true);
    const { error } = await supabase.from("contas").update({
      nome: n,
      valor: v,
      vencimento: vencimentoIso,
      categoria_id: categoriaId || null,
      observacoes: observacoes.trim() || null,
    }).eq("id", conta.id);
    setFrameBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta atualizada.");
    onSaved();
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent<EditContaFrameMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "contasfacil-editar-conta-frame") return;
      if (data.type === "height") setIframeHeight(Math.max(560, Math.min(1200, data.height)));
      if (data.type === "cancel") onClose();
      if (data.type === "submit") salvar(data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [conta, categorias, busy]);

  return (
    <div className="pad-fluid-x pt-6 pb-24">
      <header className="flex items-center gap-3 mb-5 min-w-0">
        <Button type="button" variant="ghost" size="icon" aria-label="Cancelar edição" onClick={onClose}>
          <ArrowLeft size={20} />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-fluid-2xl font-bold truncate">Editar conta</h1>
          <p className="text-fluid-sm text-muted-foreground truncate">Atualize os dados da conta</p>
        </div>
      </header>

      <iframe
        ref={iframeRef}
        title="Formulário de edição de conta"
        srcDoc={frameHtml}
        className="block w-full bg-transparent"
        style={{ height: iframeHeight, border: 0 }}
        sandbox="allow-scripts allow-forms allow-same-origin"
        aria-busy={busy}
      />
    </div>
  );
}

function buildEditarContaFrameHtml(conta: Conta, categorias: Array<{ id: string; nome: string }>) {
  const initial = JSON.stringify({
    nome: conta.nome,
    valor: Number(conta.valor).toFixed(2).replace(".", ","),
    vencimento: conta.vencimento.slice(0, 10),
    categoriaId: conta.categoria_id ?? "",
    observacoes: conta.observacoes ?? "",
    recorrente: conta.tipo === "recorrente",
  }).replace(/</g, "\\u003c");
  const categoriasJson = JSON.stringify(categorias).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <style>
    :root{color-scheme:only light;--card:#ffffff;--text:#123033;--muted:#667a7b;--border:#dbecea;--primary:#12b981;--secondary:#e8f8f3;--shadow-card:0 2px 12px -2px rgba(10,120,100,.14);--shadow-elevated:0 8px 32px -8px rgba(10,120,100,.28);font-family:"Plus Jakarta Sans",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;background:transparent;color:var(--text);font-family:inherit}body{overflow:hidden}button,input,textarea,select{font:inherit;font-size:16px}button{border:0;cursor:pointer;touch-action:manipulation}input,textarea,select{appearance:auto;-webkit-appearance:auto;width:100%;min-height:48px;border:1px solid var(--border);border-radius:18px;background:#fff!important;color:#111827!important;-webkit-text-fill-color:#111827!important;caret-color:#111827!important;padding:0 16px;outline:none;line-height:normal;opacity:1!important;user-select:text;-webkit-user-select:text;box-shadow:var(--shadow-card)}textarea{min-height:96px;padding-block:12px;resize:none}input:focus,textarea:focus,select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(18,185,129,.18),var(--shadow-card)}input::placeholder,textarea::placeholder{color:#6b7280;-webkit-text-fill-color:#6b7280;opacity:1}.stack{display:grid;gap:16px}.field{display:grid;gap:8px}label{color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.grid2{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:360px){.grid2{grid-template-columns:1fr 1fr}}.note{font-size:12px;color:var(--muted);margin:0}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}.btn{min-height:48px;border-radius:14px;font-weight:800}.outline{background:#fff;color:var(--text);border:1px solid var(--border)}.save{background:linear-gradient(135deg,#2dd4bf 0%,#10b981 100%);color:#fff;box-shadow:var(--shadow-elevated)}.btn:disabled{opacity:.7}
  </style>
</head>
<body>
  <form id="form" class="stack" novalidate>
    <div class="field"><label for="nome">Nome</label><input id="nome" name="nome" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" /></div>
    <div class="grid2"><div class="field"><label for="valor">Valor</label><input id="valor" name="valor" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" /></div><div class="field"><label for="vencimento">Vencimento</label><input id="vencimento" name="vencimento" type="date" /></div></div>
    <div class="field"><label for="categoriaId">Categoria</label><select id="categoriaId" name="categoriaId"></select></div>
    <div class="field"><label for="observacoes">Observações</label><textarea id="observacoes" name="observacoes" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></textarea></div>
    <p id="note" class="note" hidden>Esta é uma parcela de uma conta recorrente. A edição vale só para esta parcela.</p>
    <div class="actions"><button id="cancelBtn" type="button" class="btn outline">✕ Cancelar</button><button id="saveBtn" type="submit" class="btn save">✓ Salvar</button></div>
  </form>
  <script>
    const SOURCE='contasfacil-editar-conta-frame';const initial=${initial};const categorias=${categoriasJson};let busy=false;const $=(id)=>document.getElementById(id);const post=(message)=>parent.postMessage({source:SOURCE,...message},'*');const reportHeight=()=>post({type:'height',height:document.documentElement.scrollHeight+8});function escapeHtml(value){return String(value).replace(/[&<>'"]/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
    $('nome').value=initial.nome||'';$('valor').value=initial.valor||'';$('vencimento').value=initial.vencimento||'';$('observacoes').value=initial.observacoes||'';$('note').hidden=!initial.recorrente;$('categoriaId').innerHTML='<option value="">— Sem categoria —</option>'+categorias.map((cat)=>'<option value="'+cat.id+'">'+escapeHtml(cat.nome||'Categoria')+'</option>').join('');$('categoriaId').value=initial.categoriaId||'';
    function focusNative(target){if(!target||!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))return;setTimeout(()=>target.focus({preventScroll:false}),0)}document.addEventListener('pointerup',(event)=>focusNative(event.target),true);document.addEventListener('touchend',(event)=>focusNative(event.target),true);$('cancelBtn').addEventListener('click',()=>post({type:'cancel'}));$('form').addEventListener('submit',(event)=>{event.preventDefault();if(busy)return;post({type:'submit',payload:{nome:$('nome').value,valor:$('valor').value,vencimento:$('vencimento').value,categoriaId:$('categoriaId').value,observacoes:$('observacoes').value}})});window.addEventListener('message',(event)=>{const data=event.data||{};if(data.source!=='contasfacil-editar-conta-parent')return;if(data.type==='busy'){busy=Boolean(data.busy);$('saveBtn').disabled=busy;$('saveBtn').textContent=busy?'Salvando...':'✓ Salvar'}});new ResizeObserver(reportHeight).observe(document.body);reportHeight();
  </script>
</body>
</html>`;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="text-muted-foreground shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0 flex items-start justify-between gap-2 flex-wrap">
        <span className="text-fluid-sm text-muted-foreground">{label}</span>
        <span className="text-fluid-sm font-semibold break-words text-right min-w-0">{value}</span>
      </div>
    </div>
  );
}
