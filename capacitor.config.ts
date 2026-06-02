import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Fácil",
  webDir: ".output/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
