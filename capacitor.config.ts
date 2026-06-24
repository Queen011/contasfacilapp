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
};

export default config;
