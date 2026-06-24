import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Fácil",
  webDir: "dist/client",
  android: {
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
