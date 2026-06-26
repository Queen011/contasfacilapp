import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Facil",
  webDir: ".output/public",

  android: {
    allowMixedContent: true,
  },

  plugins: {
    Keyboard: {
      resize: "native",
    },
  },

  server: {
    cleartext: true,
  },
};

export default config;
