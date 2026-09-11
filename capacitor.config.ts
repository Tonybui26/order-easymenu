import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "order.goeasy.menu",
  appName: "EasyMenu OM",
  // Load the bundled shell first so offline devices see a retry UI instead of
  // the WebView error page. The shell probes the network, then navigates to
  // the app URL when reachable (same pattern as Pocket).
  // Dev: shell uses http://192.168.1.69:3001 (see capacitor-shell isDev).
  // Prod: set isDev = false in capacitor-shell before release builds.
  webDir: "capacitor-shell",
  server: {
    // Do not set server.url here — that skips capacitor-shell entirely.
    // url: "https://order.goeasy.menu",
    // url: "http://192.168.1.69:3001",
    cleartext: true, // needed for local HTTP (192.168.x.x) during Capacitor dev
    allowNavigation: [
      "order.goeasy.menu",
      "*.goeasy.menu",
      "192.168.1.69",
    ],
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
