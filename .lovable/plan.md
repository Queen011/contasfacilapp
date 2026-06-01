
# Controle Financeiro — PWA Mobile

App web mobile-first (instalável no Android via "Adicionar à tela inicial"), com login na nuvem e gestão de contas recorrentes e avulsas.

## Visual

- Paleta: Ciano & Verde Menta (`#f0fdfa`, `#5eead4`, `#10b981`, `#0f766e`) — definida em `src/styles.css` via tokens oklch.
- Tipografia: Plus Jakarta Sans (suave, legível em mobile).
- Cards arredondados, ícone grande colorido por categoria à esquerda, valor à direita, badge de status colorido.
- Layout mobile-first com bottom navigation (Início, Pendentes, Pagas, Adicionar).

## Telas

1. **Login / Cadastro** — e-mail + senha (Lovable Cloud Auth).
2. **Início (Dashboard)** — total do mês, total atrasado, próximos vencimentos, gráficos simples.
3. **Pendentes & Atrasadas** — lista filtrável; cards vermelhos quando vencidos.
4. **Pagas & Quitadas** — histórico; "Paga" = parcela do período, "Quitada" = conta encerrada.
5. **Nova Conta** — formulário com:
   - Nome, valor, vencimento, categoria (com ícone), observações.
   - Tipo: Avulsa / Recorrente.
   - Recorrência: Mensal / Bimestral / Trimestral / Semestral / Anual / Personalizada (ex: IPVA 3x ao ano).
6. **Detalhe da Conta** — histórico de pagamentos, marcar como paga, quitar definitivamente, editar, excluir.

## Categorias com ícones (Lucide + cores)

Luz (Cemig) ⚡ amarelo, Internet 📶 azul, Água 💧 ciano, Gás 🔥 laranja, Cartão 💳 roxo, Boleto 🧾 cinza, IPVA 🚗 verde, MEI 📄 esmeralda, Aluguel 🏠 marrom, Streaming 📺 rosa, Outros 📌.

## Lógica de status

- `pendente` (padrão ao criar) → `paga` (marca pagamento, gera próxima ocorrência se recorrente) → `quitada` (encerra de vez, não gera mais).
- Job no client: ao abrir o app, recalcula contas `pendente` com `vencimento < hoje` → `atrasada`.
- Recorrentes: ao marcar como paga, cria automaticamente a próxima parcela com o próximo vencimento conforme a recorrência (IPVA anual = +1 ano; mensal = +1 mês; personalizada = lista de meses).
- Se uma recorrente anual chega no novo período e a anterior ainda está pendente → vira atrasada e a nova guia é adicionada normalmente.

## Banco de dados (Lovable Cloud)

```text
categorias (id, user_id, nome, icone, cor)         -- seed inicial automática por usuário
contas (
  id, user_id, categoria_id, nome, valor,
  vencimento, status, observacoes,
  tipo,                -- 'avulsa' | 'recorrente'
  recorrencia,         -- 'mensal'|'bimestral'|...|'anual'|'personalizada'|null
  meses_personalizados,-- int[] (1-12) p/ IPVA etc.
  conta_pai_id,        -- liga ocorrências à conta original
  pago_em, created_at
)
```

RLS: cada usuário só vê/edita as próprias linhas (`user_id = auth.uid()`).

## Detalhes técnicos

- Stack: TanStack Start + Tailwind + shadcn/ui + Lovable Cloud (Supabase).
- Manifest `manifest.json` + ícone para instalar como app no Android (sem service worker — evita problemas no preview).
- Rotas: `/login`, `/` (dashboard), `/pendentes`, `/pagas`, `/nova`, `/conta/$id` — todas dentro de `_authenticated` exceto `/login`.
- Server functions com `requireSupabaseAuth` para CRUD.
- Bottom nav fixa nas telas autenticadas.

## Não incluso nesta primeira versão (posso adicionar depois)

- Notificações push de vencimento (requer empacotar como APK).
- Exportar relatório PDF/CSV.
- Múltiplas contas bancárias / receitas.
- Anexar comprovantes (fotos de boletos).

Me avise se quer algum desses agora ou se posso seguir com o escopo acima.
