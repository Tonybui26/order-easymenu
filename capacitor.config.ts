import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Flip `server.url` for local Capacitor builds (comment one, uncomment the other).
 * Keep the LAN IP in sync with capacitor-shell/index.html and allowNavigation.
 */
const config: CapacitorConfig = {
  appId: "order.goeasy.menu",
  appName: "EasyMenu OM",
  // Bundled shell is only the offline/error page (errorPath).
  // Loading the app via server.url keeps the Capacitor bridge + plugins
  // (customer display, printers, immersive) working — unlike shell→location.replace.
  webDir: "capacitor-shell",
  server: {
    url: "https://order.goeasy.menu",
    // url: "http://192.168.0.98:3001",
    // Local offline UI when server.url fails to load (no network / host down).
    errorPath: "index.html",
    cleartext: true, // needed for local HTTP (192.168.x.x) during Capacitor dev
    allowNavigation: ["order.goeasy.menu", "*.goeasy.menu", "192.168.0.98"],
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
    /**
     * Local Mode foundation — unencrypted DB for pilots.
     * Plugin is in the native shell; JS can evolve via server.url without rebuild.
     */
    CapacitorSQLite: {
      androidIsEncryption: false,
      iosIsEncryption: false,
      iosDatabaseLocation: "Library/CapacitorDatabase",
    },
  },
};

export default config;
