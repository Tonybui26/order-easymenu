/**
 * IminCashbox plugin entry — registers Capacitor native / web implementations.
 */

import { registerPlugin } from "@capacitor/core";

const IminCashbox = registerPlugin("IminCashbox", {
  web: () => import("./web").then((m) => new m.IminCashboxWeb()),
});

export * from "./definitions.js";
export { IminCashbox };
