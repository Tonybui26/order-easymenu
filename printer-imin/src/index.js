/**
 * PrinterImin plugin entry — registers Capacitor native / web implementations.
 */

import { registerPlugin } from "@capacitor/core";

const PrinterImin = registerPlugin("PrinterImin", {
  web: () => import("./web").then((m) => new m.PrinterIminWeb()),
});

export * from "./definitions.js";
export { PrinterImin };
