import { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Facil",
  webDir: ".output/public",

  android: {
    allowMixedContent: true,
    captureInput: false,
    initialFocus: true,
  },

  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      style: KeyboardStyle.Light,
      resizeOnFullScreen: false,
    },
  },

  server: {
    cleartext: true,
  },
};

export default config;
