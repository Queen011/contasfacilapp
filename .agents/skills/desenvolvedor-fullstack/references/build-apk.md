# Build do APK Android

## Pré-requisitos (uma vez)
- Node 20+, Android Studio com JDK embutido em `C:\Program Files\Android\Android Studio\jbr`.
- Variáveis no PowerShell:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

## Ciclo padrão após mudanças no Lovable
```powershell
cd "E:\Contas Facil"
git reset --hard HEAD
git clean -fd
git pull origin main
npm install
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm run android:sync
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```
APK final: `android\app\build\outputs\apk\debug\app-debug.apk` (~30 MB).

## Enviar para outra pessoa (APK debug)
1. Mandar apenas `app-debug.apk` (WhatsApp, Drive, etc.). Ignorar `output-metadata.json`.
2. No celular do destinatário: Configurações → Segurança → permitir "Instalar apps de fontes desconhecidas" para o app onde recebeu (WhatsApp/Chrome/Files).
3. Tocar no .apk → Instalar.
4. Funciona offline para abrir, mas precisa de internet para login Google e sincronizar contas.

## Release assinado (futuro, Play Store)
Quando o usuário pedir:
1. Gerar keystore: `keytool -genkey -v -keystore contasfacil-release.keystore -alias contasfacil -keyalg RSA -keysize 2048 -validity 10000`. **Guardar o arquivo e senhas — se perder, não dá pra atualizar o app na Play.**
2. Configurar `android/key.properties` + bloco `signingConfigs` em `android/app/build.gradle`.
3. `.\gradlew.bat bundleRelease` → gera `.aab` em `android/app/build/outputs/bundle/release/`.
4. Play Console (US$ 25 conta única) → criar app → upload AAB → ficha da loja → política de privacidade obrigatória.

## Não esqueça
- Sempre `npm run android:sync` depois de qualquer mudança no código web, senão o APK continua com a versão antiga.
- `gradlew clean` resolve maioria dos builds estranhos.
- Computador NÃO precisa ficar ligado depois do APK instalado — o app é independente.
