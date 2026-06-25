import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Fácil",
  webDir: "dist/client",
  initialFocus: true,
  android: {
    allowMixedContent: true,
    captureInput: true,
    initialFocus: true,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
