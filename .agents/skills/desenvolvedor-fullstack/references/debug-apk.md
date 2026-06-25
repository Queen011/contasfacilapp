# Debug do APK — problemas comuns

## Inspeção remota
Com `webContentsDebuggingEnabled: true` (já configurado), conectar o celular por USB com depuração ativa e abrir no Chrome desktop: `chrome://inspect/#devices` → "inspect" no app. Mostra console, network, DOM da WebView ao vivo.

## Teclado cobrindo inputs (problema reportado)
Sintoma: ao tocar em um input, o teclado abre por cima do campo e a tela não rola.

**Causas e correções:**
1. `capacitor.config.ts` deve ter:
```ts
plugins: { Keyboard: { resize: "native", resizeOnFullScreen: true } }
```
Se `resize: "none"` o conteúdo não se ajusta. `"native"` faz o Android empurrar a view. (Já está correto neste projeto — se voltar a quebrar, revisar este bloco primeiro.)

2. `AndroidManifest.xml` da `MainActivity` deve ter `android:windowSoftInputMode="adjustResize"` (padrão do Capacitor). Não usar `adjustPan`.

3. Containers com `h-screen` / `min-h-screen` + `overflow-hidden` impedem scroll quando o teclado abre. Usar `min-h-dvh` e deixar o body rolável; envolver formulários com `overflow-y-auto`.

4. Adicionar listener para rolar o input ao foco em telas problemáticas:
```ts
import { Keyboard } from "@capacitor/keyboard";
useEffect(() => {
  const sub = Keyboard.addListener("keyboardWillShow", () => {
    document.activeElement?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  return () => { sub.then(s => s.remove()); };
}, []);
```

5. Posições `fixed bottom-0` (BottomNav, FABs) precisam sumir quando teclado abre:
```ts
Keyboard.addListener("keyboardWillShow", () => document.body.classList.add("kb-open"));
Keyboard.addListener("keyboardWillHide", () => document.body.classList.remove("kb-open"));
```
+ CSS: `body.kb-open .bottom-nav { display: none; }`.

## Tela branca ao abrir APK
- Esqueceu `npm run android:sync` depois de mudar código. `dist/client` desatualizado.
- Erro de JS no boot. Inspecionar via `chrome://inspect` e olhar console.
- Caminho de asset errado: verificar `src/lib/app-assets.ts` e `scripts/build-capacitor-index.mjs`.

## Login Google falha no APK
- "Provider was not initialized" → `initializeNativeGoogleLogin()` falhou; checar SHA-1 do keystore debug em `android/app/google-services.json` (Firebase/Cloud Console deve ter o SHA atual: `keytool -list -v -keystore $env:USERPROFILE\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android`).
- "Token do Google não recebido" → `webClientId` errado. Conferir `GOOGLE_WEB_CLIENT_ID` em `src/routes/login.tsx`.
- Cancelado pelo usuário não mostra toast (já tratado).

## Gradle / build falhando
- `JAVA_HOME` não setado → erro "Unsupported class file major version". Setar conforme `build-apk.md`.
- "SDK location not found" → criar `android/local.properties` com `sdk.dir=C:\\Users\\<user>\\AppData\\Local\\Android\\Sdk`.
- Lockfile corrompido → `rm -r node_modules; rm package-lock.json; npm install`.
- `gradlew clean` antes de novo `assembleDebug` resolve cache podre.

## App fecha sozinho / crash
- Pegar logcat: `adb logcat *:E | Select-String "com.contasfacil"`.
- Erros de RLS aparecem como 401/403 — checar policies da tabela afetada.

## Scanner de boleto não abre
- Permissão de câmera negada → Configurações do Android → Apps → Contas Fácil → Permissões → Câmera.
- `@capacitor-mlkit/barcode-scanning` exige Google Play Services atualizado.

## Notificações não chegam
- `@capacitor/local-notifications` precisa `LocalNotifications.requestPermissions()` no primeiro uso.
- Android 13+ exige permissão `POST_NOTIFICATIONS` no manifest e prompt em runtime.
