import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Facil",
  webDir: "dist/client",

  android: {
    allowMixedContent: true,
    captureInput: true,
    initialFocus: false,
    useLegacyBridge: true,
  },

  plugins: {
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },

  server: {
    cleartext: true,
  },
};

export default config;
