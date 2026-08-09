/**
 * PrinterUsb plugin entry — registers Capacitor native / web implementations.
 */

import { registerPlugin } from "@capacitor/core";

const PrinterUsb = registerPlugin("PrinterUsb", {
  web: () => import("./web").then((m) => new m.PrinterUsbWeb()),
});

export * from "./definitions.js";
export { PrinterUsb };
