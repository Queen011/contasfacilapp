import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Facil",
  webDir: "dist/client",

  android: {
    allowMixedContent: true,
    captureInput: false,
    initialFocus: false,
    useLegacyBridge: true,
  },

  plugins: {
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },

  server: {
    cleartext: true,
  },
};

export default config;
