import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Facil",
  webDir: ".output/public",

  android: {
    allowMixedContent: true,
    captureInput: false,
    initialFocus: true,
  },

  server: {
    cleartext: true,
  },
};

export default config;
