---
name: desenvolvedor-fullstack
description: Guia fullstack do projeto Contas Fácil (TanStack Start + Supabase + Capacitor Android). Use ao adicionar features, mexer em rotas/banco, gerar/atualizar o APK, ou diagnosticar bugs no APK (incluindo o problema do teclado cobrindo inputs, splash branca, login Google nativo, falhas de build Gradle).
---

# Desenvolvedor Fullstack — Contas Fácil

Skill de referência para o app **Contas Fácil**: web (TanStack Start) + Android (Capacitor 8) + backend Lovable Cloud (Supabase).

## Quando usar cada referência

| Tarefa | Leia |
| --- | --- |
| Padrões do projeto (rotas, auth, queries, RLS, tokens de tema) | `references/projeto.md` |
| Gerar/atualizar APK, enviar para outras pessoas, assinar release | `references/build-apk.md` |
| Bugs no APK (teclado, splash, Google login, gradle, tela branca) | `references/debug-apk.md` |
| Checklist fullstack genérico (segurança, performance, SEO, a11y) | `references/fullstack-checklist.md` |

## Regras sempre-aplicáveis

1. **Modo claro apenas** — usuário rejeitou modo escuro. Não reintroduzir `ThemeToggle` nem `dark:` em massa.
2. **Sem scroll horizontal** no dashboard e telas principais — vertical apenas. Containers com `overflow-x-hidden` quando necessário e larguras em `min-w-0`.
3. **Falar com o usuário em português, direto e prático.** Ele não é desenvolvedor profissional; comandos sempre completos e copiáveis (PowerShell no Windows).
4. **Nunca expor**: Supabase URL/dashboard, service role key, senha do banco. Chamar de "Lovable Cloud / backend".
5. **APK debug é suficiente para testes** — release assinado / Play Store só quando o usuário pedir.
6. **Capacitor 8 + plugin Google nativo** = `@capgo/capacitor-social-login` (já configurado em `src/routes/login.tsx`). No web usa `lovable.auth.signInWithOAuth`.
7. Antes de qualquer mudança que afete o APK, lembrar o usuário do ciclo: `git pull` → `npm install` → `npm run android:sync` → `gradlew assembleDebug`.

## Stack resumida

- **Frontend**: TanStack Start v1, React 19, Tailwind v4 (tokens em `src/styles.css`), shadcn/ui, Plus Jakarta Sans.
- **Backend**: Lovable Cloud (Supabase) — auth, postgres com RLS, server functions via `createServerFn`.
- **Mobile**: Capacitor 8 (`@capacitor/android`, `@capacitor/keyboard`, `@capacitor-mlkit/barcode-scanning`, `@capacitor/local-notifications`, `@capgo/capacitor-social-login`).
- **App ID Android**: `com.contasfacil.app`.
- **Scripts chave**: `npm run android:sync`, `npm run android:run`, build manual com `cd android && .\gradlew.bat assembleDebug`.
