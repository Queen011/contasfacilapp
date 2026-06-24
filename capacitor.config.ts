import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Fácil",
  webDir: "dist/client",
  android: {
    captureInput: false,
    initialFocus: false,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "disable",
      style: "LIGHT",
      hidden: false,
    },
  },
};

export default config;
