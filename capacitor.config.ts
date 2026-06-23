import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contasfacil.app",
  appName: "Contas Fácil",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
  },
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId:
        "953013359097-pnpqpnrh8d652ts0gn9ph2fau46573lf.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
