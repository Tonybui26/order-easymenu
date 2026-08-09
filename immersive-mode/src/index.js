/**
 * ImmersiveMode plugin entry — registers Capacitor native / web implementations.
 */

import { registerPlugin } from "@capacitor/core";

const ImmersiveMode = registerPlugin("ImmersiveMode", {
  web: () => import("./web").then((m) => new m.ImmersiveModeWeb()),
});

export * from "./definitions.js";
export { ImmersiveMode };
