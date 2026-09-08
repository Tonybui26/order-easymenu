/**
 * Web stub — secondary customer display is Android-only.
 */

import { WebPlugin } from "@capacitor/core";

export class CustomerDisplayWeb extends WebPlugin {
  async isAvailable() {
    return { available: false };
  }

  async open() {
    return;
  }

  async close() {
    return;
  }
}
