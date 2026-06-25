# Checklist Fullstack (genérico)

## Antes de subir feature
- [ ] Tipos TS sem `any` solto. `tsgo` limpo.
- [ ] RLS habilitada em toda tabela nova + `GRANT` apropriado.
- [ ] Secrets via `add_secret` (nunca commitar). Chaves publishable OK no client.
- [ ] Inputs validados com Zod no server function.
- [ ] Loader/queries com chave estável; `invalidateQueries` após mutations.
- [ ] Tratamento de erro visível ao usuário (toast `sonner`).

## Performance
- [ ] Imagens via `<img loading="lazy">` e dimensões fixas.
- [ ] Listas longas: paginação ou virtualização.
- [ ] Evitar refetch em foco quando custoso (`refetchOnWindowFocus: false`).
- [ ] Bundle: lazy-load rotas pesadas (scanner, charts) com `React.lazy`.

## Acessibilidade
- [ ] Labels em todo input. `aria-label` em botões só com ícone.
- [ ] Contraste AA (foreground/background tokens já calibrados).
- [ ] Áreas tocáveis ≥ 44px (mobile).

## SEO (web)
- [ ] Cada rota com `head()`: title <60 chars, description <160, OG image.
- [ ] H1 único. HTML semântico (`<main>`, `<nav>`, `<section>`).

## Mobile (APK)
- [ ] Testar com teclado aberto em todos os formulários.
- [ ] Testar offline: estados de loading e erro de rede.
- [ ] Safe areas: `env(safe-area-inset-*)` em headers e bottom nav.
- [ ] Back button do Android tratado em modais (`App.addListener("backButton", ...)`).

## Segurança
- [ ] Nenhuma operação privilegiada sem checagem de role server-side.
- [ ] Webhooks com verificação de assinatura (HMAC) antes de processar.
- [ ] `service_role` SÓ em `*.server.ts` importado dinamicamente.
- [ ] CORS configurado em endpoints públicos.

## Deploy
- [ ] Web: publicar pelo Lovable após milestone.
- [ ] APK: rebuild + redistribuir após mudanças que afetem mobile.
- [ ] Versão bump em `android/app/build.gradle` (`versionCode`, `versionName`) antes de release.
