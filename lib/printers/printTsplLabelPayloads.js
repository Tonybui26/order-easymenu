/**
 * Send TSPL label payloads — one TCP connect/send/disconnect per label.
 * GP-2120T and similar printers often drop labels after the first PRINT 1
 * when multiple labels are sent in a single payload.
 */

import { registerPlugin } from "@capacitor/core";

const PrinterTcpSocket = registerPlugin("PrinterTcpSocket");

const DEFAULT_PORT = 9100;

/**
 * @param {Object} printer - { localIp, port, name? }
 * @param {string[]} payloads - One TSPL document per label
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=5000]
 * @param {number} [options.delayBeforeDisconnectMs=100]
 * @param {number} [options.delayAfterDisconnectMs=300]
 * @returns {Promise<{ success: boolean, message: string, printedCount: number }>}
 */
export async function printTsplLabelPayloads(printer, payloads, options = {}) {
  const printerIp = printer?.localIp;
  const printerPort = Number(printer?.port ?? DEFAULT_PORT);
  const timeoutMs = options.timeoutMs ?? 5000;
  const delayBeforeDisconnectMs = options.delayBeforeDisconnectMs ?? 100;
  const delayAfterDisconnectMs = options.delayAfterDisconnectMs ?? 300;

  if (!printerIp) {
    return {
      success: false,
      message: "TSPL print failed: printer IP is required",
      printedCount: 0,
    };
  }

  if (!Array.isArray(payloads) || payloads.length === 0) {
    return {
      success: false,
      message: "TSPL print failed: no labels to print",
      printedCount: 0,
    };
  }

  let printedCount = 0;

  for (let i = 0; i < payloads.length; i++) {
    let connectionId = null;

    try {
      console.log(
        `[TSPL] Label ${i + 1}/${payloads.length} → ${printerIp}:${printerPort}`,
      );

      const connectResult = await PrinterTcpSocket.connect({
        ipAddress: printerIp,
        port: printerPort,
        timeoutMs,
      });

      connectionId = connectResult.connectionId;

      await PrinterTcpSocket.send({
        connectionId,
        data: payloads[i],
        encoding: "utf8",
      });

      if (delayBeforeDisconnectMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayBeforeDisconnectMs),
        );
      }

      await PrinterTcpSocket.disconnect({ connectionId });
      connectionId = null;
      printedCount++;

      if (
        delayAfterDisconnectMs > 0 &&
        i < payloads.length - 1
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayAfterDisconnectMs),
        );
      }
    } catch (error) {
      console.error(`[TSPL] Label ${i + 1} failed:`, error);

      if (connectionId) {
        try {
          await PrinterTcpSocket.disconnect({ connectionId });
        } catch (cleanupError) {
          console.error("[TSPL] Cleanup error:", cleanupError);
        }
      }

      return {
        success: false,
        message: `TSPL print failed on label ${i + 1}/${payloads.length}: ${error.message || "Unknown error"}`,
        printedCount,
      };
    }
  }

  return {
    success: true,
    message: `Printed ${printedCount} TSPL label(s)`,
    printedCount,
  };
}
