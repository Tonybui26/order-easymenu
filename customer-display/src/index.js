/**
 * CustomerDisplay plugin entry — registers Capacitor native / web implementations.
 */

import { registerPlugin } from "@capacitor/core";

const CustomerDisplay = registerPlugin("CustomerDisplay", {
  web: () => import("./web").then((m) => new m.CustomerDisplayWeb()),
});

export * from "./definitions.js";
export { CustomerDisplay };
