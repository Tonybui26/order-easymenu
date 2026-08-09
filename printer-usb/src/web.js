/**
 * Web stub — USB host printing is Android-only.
 */

import { WebPlugin } from "@capacitor/core";

export class PrinterUsbWeb extends WebPlugin {
  async listDevices() {
    throw new Error(
      "USB printing requires the Android Order Manager app (not available in browser).",
    );
  }

  async connect() {
    throw new Error(
      "USB printing requires the Android Order Manager app (not available in browser).",
    );
  }

  async send() {
    throw new Error("USB printing requires the Android Order Manager app.");
  }

  async disconnect() {
    return;
  }

  async resetAll() {
    return {
      connectionsCleared: 0,
      message: "No USB connections in web browser",
    };
  }

  async getStatus() {
    return {
      activeConnections: 0,
      connectionIds: [],
      platform: "web",
    };
  }
}
