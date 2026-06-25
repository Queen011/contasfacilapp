import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Facil",
  webDir: "dist/client",

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
