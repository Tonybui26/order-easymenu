import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "order.goeasy.menu",
  appName: "Order Manager by GoEasyMenu",
  // Small bundled shell; live app loads from server.url when online.
  webDir: "capacitor-shell",
  server: {
    url: "https://order.goeasy.menu",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#D76228",
      showSpinner: false,
      androidSpinnerStyle: "small",
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
