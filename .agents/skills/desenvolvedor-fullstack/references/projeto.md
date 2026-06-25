# Padrões do projeto Contas Fácil

## Estrutura de rotas
- File-based em `src/routes/`. Layout autenticado é `_app.tsx` (com `<Outlet />`); páginas usam prefixo `_app.` (ex.: `_app.dashboard.tsx`, `_app.nova.tsx`, `_app.conta.$id.tsx`).
- `/login` é pública. `__root.tsx` injeta `<AuthProvider>` e `<Toaster>`.
- Nunca editar `src/routeTree.gen.ts` nem `src/integrations/supabase/*` (auto-gerados).

## Auth
- Contexto em `src/lib/auth.tsx` (`useAuth()`).
- Login Google: web → `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`. APK → `@capgo/capacitor-social-login` + `supabase.auth.signInWithIdToken`. Web client ID hardcoded em `src/routes/login.tsx`.
- Sem signup por email/senha exposto. Sem anônimo.

## Dados
- TanStack Query. Helpers em `src/lib/queries.ts`, `src/lib/finance.ts`.
- Para reads use `useQuery` ou loader + `ensureQueryData`. Para writes, server functions em `src/lib/api/*.functions.ts` (nunca em `src/server/`).
- Tipos do banco em `src/integrations/supabase/types.ts`.

## RLS
- Toda tabela `public.*` precisa `GRANT` + `ENABLE RLS` + policies. Roles em tabela separada `user_roles` + função `has_role` (security definer).

## Design system
- Tokens HSL em `src/styles.css` (`--background`, `--primary` verde esmeralda, gradientes `--gradient-primary`, `--gradient-soft`, sombras `--shadow-elevated`).
- Nunca usar `text-white`, `bg-black`, `bg-[#...]` em componentes — sempre tokens semânticos.
- Fonte: Plus Jakarta Sans (já importada em `__root.tsx`).
- Layout mobile-first. `BottomNav` fixo. Containers principais com `max-w-md mx-auto` ou `max-w-screen-sm`.

## Capacitor
- `capacitor.config.ts`: `appId=com.contasfacil.app`, `webDir=dist/client`, `Keyboard.resize="native"`, `resizeOnFullScreen=true`.
- Build web → `vite build` → `scripts/build-capacitor-index.mjs` gera `dist/client/index.html` consumido pela WebView.

## Comandos com o usuário
Sempre PowerShell completo, com `cd "E:\Contas Facil"` no topo quando relevante.
