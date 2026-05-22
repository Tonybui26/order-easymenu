/**
 * Isolated TSPL label test print — does not use printerUtilsNew or ESC/POS paths.
 */

import { registerPlugin } from "@capacitor/core";
import { createTsplTestLabel } from "./tspl/createTsplTestLabel";

const PrinterTcpSocket = registerPlugin("PrinterTcpSocket");

const DEFAULT_PORT = 9100;

/**
 * Send a GP-2120T test label over raw TCP (UTF-8 TSPL).
 *
 * @param {Object} printer - { localIp, port, name? }
 * @param {Object} options
 * @param {string} [options.text="HELLO"] - Text on the test label
 * @param {number} [options.timeoutMs=5000]
 * @param {number} [options.delayAfterDisconnect=200]
 * @returns {Promise<{ success: boolean, message: string, duration?: number }>}
 */
export async function printTsplTestLabel(printer, options = {}) {
  let connectionId = null;
  const startTime = Date.now();

  const printerIp = printer?.localIp;
  const printerPort = printer?.port ?? DEFAULT_PORT;
  const text = options.text ?? "HELLO";

  if (!printerIp) {
    return {
      success: false,
      message: "TSPL test failed: printer IP is required",
      duration: Date.now() - startTime,
    };
  }

  try {
    console.log(
      `[TSPL] Connecting to ${printerIp}:${printerPort} for test label`,
    );

    const connectResult = await PrinterTcpSocket.connect({
      ipAddress: printerIp,
      port: Number(printerPort),
      timeoutMs: options.timeoutMs ?? 5000,
    });

    connectionId = connectResult.connectionId;

    const tsplPayload = createTsplTestLabel({ text });

    await PrinterTcpSocket.send({
      connectionId,
      data: tsplPayload,
      encoding: "utf8",
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    await PrinterTcpSocket.disconnect({ connectionId });
    connectionId = null;

    const delayAfter = options.delayAfterDisconnect ?? 200;
    if (delayAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayAfter));
    }

    const duration = Date.now() - startTime;
    return {
      success: true,
      message: `TSPL test label printed (${text}) in ${duration}ms`,
      duration,
    };
  } catch (error) {
    console.error("[TSPL] Test print error:", error);

    if (connectionId) {
      try {
        await PrinterTcpSocket.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[TSPL] Cleanup error:", cleanupError);
      }
    }

    const duration = Date.now() - startTime;
    return {
      success: false,
      message: `TSPL test failed: ${error.message || "Unknown error"}`,
      duration,
    };
  }
}
