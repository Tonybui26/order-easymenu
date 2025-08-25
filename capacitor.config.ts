import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "order.goeasy.menu",
  appName: "order-manager-by-goeasymenu",
  webDir: "public",
  server: {
    url: "http://10.0.2.2:3001",
    cleartext: true,
  },
};

export default config;
