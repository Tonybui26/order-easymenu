/**
 * Web stub — the iMin cash-drawer jack is Android-only.
 */

import { WebPlugin } from "@capacitor/core";

export class IminCashboxWeb extends WebPlugin {
  async open() {
    throw new Error(
      "The terminal cash drawer requires the Android Order Manager app.",
    );
  }
}
