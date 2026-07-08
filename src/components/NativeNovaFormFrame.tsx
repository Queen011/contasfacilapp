import { useEffect, useMemo, useRef, useState } from "react";

import type { Recorrencia } from "@/lib/finance";
import type { Categoria } from "@/lib/queries";

export type NovaSubmit = {
  nome: string;
  valor: string;
  vencimento: string;
  categoriaId: string;
  observacoes: string;
  recorrente: boolean;
  recorrencia: Recorrencia;
  meses: number[];
};

export type NovaApplyData = Partial<Pick<NovaSubmit, "nome" | "valor" | "vencimento">> | null;

const FRAME_SOURCE = "contasfacil-nova-frame";
const PARENT_SOURCE = "contasfacil-nova-parent";

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildFrameHtml(categorias: Categoria[], initialVencimento: string, busy: boolean) {
  const categoriasJson = safeJson(categorias);
  const vencimentoJson = safeJson(initialVencimento);
  const busyJson = safeJson(busy);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <style>
    :root { color-scheme: only light; --primary:#10b981; --primary-dark:#059669; --secondary:#e8faf4; --text:#18302f; --muted:#64748b; --border:#d9ece7; --card:#ffffff; --bg:#f7fffc; }
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; width:100%; min-height:100%; overflow-x:hidden; background:transparent; color:var(--text); font-family:"Plus Jakarta Sans", Arial, sans-serif; -webkit-text-size-adjust:100%; }
    body { padding:0 0 10px; }
    form { display:grid; gap:16px; width:100%; }
    section.card { background:var(--card); border:1px solid rgba(217,236,231,.9); border-radius:24px; padding:16px; box-shadow:0 2px 12px -2px rgba(16,185,129,.12); display:grid; gap:14px; }
    label.title, p.title { display:block; margin:0 0 6px; color:var(--muted); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0; }
    input, textarea, select { width:100%; min-height:46px; border:1px solid var(--border); border-radius:10px; background:#fff !important; color:#111827 !important; -webkit-text-fill-color:#111827 !important; caret-color:#111827 !important; padding:10px 12px; font:500 16px/1.35 Arial, sans-serif; outline:none; opacity:1 !important; user-select:text; -webkit-user-select:text; }
    textarea { min-height:96px; resize:vertical; }
    input::placeholder, textarea::placeholder { color:#6b7280 !important; -webkit-text-fill-color:#6b7280 !important; opacity:1; }
    input:focus, textarea:focus, select:focus { border-color:var(--primary); box-shadow:0 0 0 2px rgba(16,185,129,.18); }
    .two { display:grid; grid-template-columns:1fr; gap:12px; }
    @media (min-width:360px) { .two { grid-template-columns:1fr 1fr; } }
    .cat-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
    @media (min-width:360px) { .cat-grid { grid-template-columns:repeat(4, minmax(0, 1fr)); } }
    button { min-height:44px; border:0; font:800 14px/1.2 Arial, sans-serif; touch-action:manipulation; }
    .cat { min-height:80px; border-radius:18px; background:#fff; border:2px solid transparent; padding:8px 6px; box-shadow:0 2px 12px -2px rgba(16,185,129,.12); color:var(--text); }
    .cat.active { border-color:var(--primary); background:var(--secondary); }
    .emoji { display:grid; width:34px; height:34px; margin:0 auto 6px; place-items:center; border-radius:999px; font-size:18px; }
    .cat-name { display:block; overflow-wrap:anywhere; font-size:11px; font-weight:900; }
    .row-toggle { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .row-left { display:flex; align-items:center; gap:12px; min-width:0; }
    .icon { display:grid; place-items:center; width:40px; height:40px; border-radius:16px; background:var(--secondary); color:var(--primary-dark); flex:0 0 auto; }
    .strong { display:block; font-size:14px; font-weight:900; }
    .hint { display:block; color:var(--muted); font-size:12px; font-weight:500; }
    input[type="checkbox"] { width:26px; min-height:26px; height:26px; accent-color:var(--primary); padding:0; flex:0 0 auto; }
    .months { display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:6px; }
    .month { border:1px solid var(--border); border-radius:12px; background:#fff; color:var(--text); font-size:12px; }
    .month.active { background:var(--primary); color:#fff; border-color:var(--primary); }
    .actions { display:grid; }
    .submit { min-height:50px; border-radius:18px; color:#fff; background:linear-gradient(135deg, #34d399 0%, #10b981 100%); box-shadow:0 8px 32px -8px rgba(16,185,129,.35); font-size:16px; }
    .submit:disabled { opacity:.65; }
  </style>
</head>
<body>
  <form id="form" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" novalidate>
    <section class="card">
      <div>
        <label class="title" for="nome">Nome</label>
        <input id="nome" name="nome" type="text" enterkeyhint="next" placeholder="Ex: Cemig - Luz" required />
      </div>
      <div class="two">
        <div>
          <label class="title" for="valor">Valor (R$)</label>
          <input id="valor" name="valor" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0,00" required />
        </div>
        <div>
          <label class="title" for="vencimento">Vencimento</label>
          <input id="vencimento" name="vencimento" type="text" inputmode="numeric" enterkeyhint="next" placeholder="dd/mm/aaaa" maxlength="10" required />
        </div>
      </div>
    </section>

    <section>
      <p class="title">Categoria</p>
      <input id="categoriaId" name="categoriaId" type="hidden" />
      <div id="categorias" class="cat-grid"></div>
    </section>

    <section class="card">
      <label class="row-toggle">
        <span class="row-left">
          <span class="icon">↻</span>
          <span><span class="strong">Conta recorrente</span><span class="hint">Gera próximas parcelas automaticamente</span></span>
        </span>
        <input id="recorrente" name="recorrente" type="checkbox" />
      </label>
      <div id="recorrenciaArea" hidden>
        <label class="title" for="recorrencia">Frequência</label>
        <select id="recorrencia" name="recorrencia">
          <option value="mensal">Mensal</option>
          <option value="bimestral">Bimestral</option>
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
          <option value="anual">Anual (ex: IPVA 1x)</option>
          <option value="personalizada">Personalizada (escolher meses)</option>
        </select>
        <div id="mesesArea" style="margin-top:12px" hidden>
          <p class="title">Meses do ano</p>
          <div id="meses" class="months"></div>
        </div>
      </div>
    </section>

    <div>
      <label class="title" for="observacoes">Observações</label>
      <textarea id="observacoes" name="observacoes" enterkeyhint="done"></textarea>
    </div>

    <div class="actions">
      <button id="submit" class="submit" type="submit">Salvar conta</button>
    </div>
  </form>

  <script>
    const SOURCE = '${FRAME_SOURCE}';
    const PARENT = '${PARENT_SOURCE}';
    const categorias = ${categoriasJson};
    const initialVencimento = ${vencimentoJson};
    let busy = ${busyJson};
    const mesesSelecionados = new Set();
    const mesesLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const emojiMap = { luz:'💡', internet:'📶', agua:'💧', 'água':'💧', gas:'🔥', 'gás':'🔥', cartao:'💳', 'cartão':'💳', boleto:'🧾', ipva:'🚗', carro:'🚗', mei:'📄', aluguel:'🏠', casa:'🏠', streaming:'📺', tv:'📺', mercado:'🛒', comida:'🍔', saude:'💊', 'saúde':'💊', educacao:'🎓', 'educação':'🎓', outros:'🏷️' };
    const form = document.getElementById('form');
    const categoriaInput = document.getElementById('categoriaId');
    const submitButton = document.getElementById('submit');
    document.getElementById('vencimento').value = initialVencimento;

    function emojiCat(cat) {
      if (cat.icone && /\p{Extended_Pictographic}/u.test(cat.icone)) return cat.icone;
      return emojiMap[String(cat.nome || '').trim().toLowerCase()] || '🏷️';
    }
    function renderCategorias() {
      const root = document.getElementById('categorias');
      root.textContent = '';
      categorias.forEach((cat) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cat';
        button.innerHTML = '<span class="emoji"></span><span class="cat-name"></span>';
        button.querySelector('.emoji').textContent = emojiCat(cat);
        button.querySelector('.emoji').style.color = cat.cor || '#10b981';
        button.querySelector('.emoji').style.background = (cat.cor || '#10b981') + '1f';
        button.querySelector('.cat-name').textContent = cat.nome || 'Categoria';
        button.addEventListener('click', () => {
          categoriaInput.value = cat.id;
          root.querySelectorAll('.cat').forEach((el) => el.classList.remove('active'));
          button.classList.add('active');
          postResize();
        });
        root.appendChild(button);
      });
    }
    function renderMeses() {
      const root = document.getElementById('meses');
      root.textContent = '';
      mesesLabels.forEach((label, index) => {
        const month = index + 1;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'month';
        button.textContent = label;
        button.addEventListener('click', () => {
          if (mesesSelecionados.has(month)) mesesSelecionados.delete(month); else mesesSelecionados.add(month);
          button.classList.toggle('active', mesesSelecionados.has(month));
        });
        root.appendChild(button);
      });
    }
    function syncRecurring() {
      const checked = document.getElementById('recorrente').checked;
      const area = document.getElementById('recorrenciaArea');
      area.hidden = !checked;
      document.getElementById('mesesArea').hidden = document.getElementById('recorrencia').value !== 'personalizada';
      postResize();
    }
    function postResize() {
      requestAnimationFrame(() => parent.postMessage({ source: SOURCE, type: 'resize', height: Math.ceil(document.documentElement.scrollHeight) }, '*'));
    }
    function setBusy(next) {
      busy = Boolean(next);
      submitButton.disabled = busy;
      submitButton.textContent = busy ? 'Salvando...' : 'Salvar conta';
    }
    function applyData(payload) {
      if (!payload) return;
      if (typeof payload.nome === 'string' && payload.nome) document.getElementById('nome').value = payload.nome;
      if (typeof payload.valor === 'string' && payload.valor) document.getElementById('valor').value = payload.valor;
      if (typeof payload.vencimento === 'string' && payload.vencimento) document.getElementById('vencimento').value = payload.vencimento;
      postResize();
    }
    document.addEventListener('pointerup', (event) => {
      const field = event.target && event.target.closest ? event.target.closest('input, textarea, select') : null;
      if (field && field.type !== 'checkbox' && field.type !== 'hidden') setTimeout(() => field.focus({ preventScroll: false }), 0);
    }, true);
    document.getElementById('recorrente').addEventListener('change', syncRecurring);
    document.getElementById('recorrencia').addEventListener('change', syncRecurring);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (busy) return;
      const data = new FormData(form);
      parent.postMessage({ source: SOURCE, type: 'submit', payload: {
        nome: String(data.get('nome') || ''),
        valor: String(data.get('valor') || ''),
        vencimento: String(data.get('vencimento') || ''),
        categoriaId: String(data.get('categoriaId') || ''),
        observacoes: String(data.get('observacoes') || ''),
        recorrente: document.getElementById('recorrente').checked,
        recorrencia: String(data.get('recorrencia') || 'mensal'),
        meses: Array.from(mesesSelecionados).sort((a, b) => a - b),
      } }, '*');
    });
    window.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.source !== PARENT) return;
      if (data.type === 'apply') applyData(data.payload);
      if (data.type === 'busy') setBusy(data.busy);
    });
    renderCategorias();
    renderMeses();
    syncRecurring();
    setBusy(busy);
    new ResizeObserver(postResize).observe(document.body);
    window.addEventListener('load', postResize);
  </script>
</body>
</html>`;
}

export function NativeNovaFormFrame({
  categorias,
  initialVencimento,
  applyData,
  busy,
  onSubmit,
}: {
  categorias: Categoria[];
  initialVencimento: string;
  applyData: NovaApplyData;
  busy: boolean;
  onSubmit: (payload: NovaSubmit) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastApplyRef = useRef<NovaApplyData>(null);
  const [height, setHeight] = useState(760);
  const srcDoc = useMemo(
    () => buildFrameHtml(categorias, initialVencimento, busy),
    [categorias, initialVencimento],
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string; height?: number; payload?: NovaSubmit };
      if (data?.source !== FRAME_SOURCE) return;
      if (data.type === "resize" && typeof data.height === "number") {
        setHeight(Math.max(520, Math.min(1800, data.height + 8)));
      }
      if (data.type === "submit" && data.payload) onSubmit(data.payload);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onSubmit]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ source: PARENT_SOURCE, type: "busy", busy }, "*");
  }, [busy]);

  useEffect(() => {
    if (!applyData) return;
    lastApplyRef.current = applyData;
    iframeRef.current?.contentWindow?.postMessage({ source: PARENT_SOURCE, type: "apply", payload: applyData }, "*");
  }, [applyData]);

  const handleLoad = () => {
    iframeRef.current?.contentWindow?.postMessage({ source: PARENT_SOURCE, type: "busy", busy }, "*");
    if (lastApplyRef.current) {
      iframeRef.current?.contentWindow?.postMessage(
        { source: PARENT_SOURCE, type: "apply", payload: lastApplyRef.current },
        "*",
      );
    }
  };

  return (
    <iframe
      ref={iframeRef}
      title="Formulário de nova conta"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      className="block w-full overflow-hidden border-0 bg-transparent"
      style={{ height }}
      sandbox="allow-scripts allow-forms allow-same-origin"
    />
  );
}