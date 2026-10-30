/**
 * Web stub — the iMin built-in printer is Android-only.
 */

import { WebPlugin } from "@capacitor/core";

export class PrinterIminWeb extends WebPlugin {
  async connect() {
    throw new Error(
      "Built-in iMin printing requires the Android Order Manager app (not available in browser).",
    );
  }

  async send() {
    throw new Error(
      "Built-in iMin printing requires the Android Order Manager app.",
    );
  }

  async disconnect() {
    return;
  }
}
