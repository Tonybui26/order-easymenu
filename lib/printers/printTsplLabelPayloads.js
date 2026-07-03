/**
 * Send TSPL label payloads — one TCP connect/send/disconnect per label.
 * GP-2120T and similar printers often drop labels after the first PRINT 1
 * when multiple labels are sent in a single payload.
 */

import { registerPlugin } from "@capacitor/core";

const PrinterTcpSocket = registerPlugin("PrinterTcpSocket");

const DEFAULT_PORT = 9100;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

async function sendSingleTsplLabel(
  printerIp,
  printerPort,
  payload,
  { timeoutMs, delayBeforeDisconnectMs },
) {
  let connectionId = null;

  try {
    const connectResult = await PrinterTcpSocket.connect({
      ipAddress: printerIp,
      port: printerPort,
      timeoutMs,
    });

    connectionId = connectResult.connectionId;

    await PrinterTcpSocket.send({
      connectionId,
      data: payload,
      encoding: "utf8",
    });

    if (delayBeforeDisconnectMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, delayBeforeDisconnectMs),
      );
    }

    await PrinterTcpSocket.disconnect({ connectionId });
  } catch (error) {
    if (connectionId) {
      try {
        await PrinterTcpSocket.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[TSPL] Cleanup error:", cleanupError);
      }
    }

    throw error;
  }
}

/**
 * @param {Object} printer - { localIp, port, name? }
 * @param {string[]} payloads - One TSPL document per label
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=5000]
 * @param {number} [options.delayBeforeDisconnectMs=100]
 * @param {number} [options.delayAfterDisconnectMs=300]
 * @param {number} [options.maxAttempts=2]
 * @param {number} [options.retryDelayMs=500]
 * @returns {Promise<{ success: boolean, message: string, printedCount: number }>}
 */
export async function printTsplLabelPayloads(printer, payloads, options = {}) {
  const printerIp = printer?.localIp;
  const printerPort = Number(printer?.port ?? DEFAULT_PORT);
  const timeoutMs = options.timeoutMs ?? 5000;
  const delayBeforeDisconnectMs = options.delayBeforeDisconnectMs ?? 100;
  const delayAfterDisconnectMs = options.delayAfterDisconnectMs ?? 300;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

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
    let lastError = null;
    let labelPrinted = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt === 1) {
          console.log(
            `[TSPL] Label ${i + 1}/${payloads.length} → ${printerIp}:${printerPort}`,
          );
        } else {
          console.log(
            `[TSPL] Label ${i + 1}/${payloads.length} retry ${attempt}/${maxAttempts}`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }

        await sendSingleTsplLabel(printerIp, printerPort, payloads[i], {
          timeoutMs,
          delayBeforeDisconnectMs,
        });

        labelPrinted = true;
        printedCount++;
        break;
      } catch (error) {
        lastError = error;
        console.error(
          `[TSPL] Label ${i + 1} attempt ${attempt}/${maxAttempts} failed:`,
          error,
        );
      }
    }

    if (!labelPrinted) {
      return {
        success: false,
        message: `TSPL print failed on label ${i + 1}/${payloads.length}: ${lastError?.message || "Unknown error"}`,
        printedCount,
      };
    }

    if (delayAfterDisconnectMs > 0 && i < payloads.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, delayAfterDisconnectMs),
      );
    }
  }

  return {
    success: true,
    message: `Printed ${printedCount} TSPL label(s)`,
    printedCount,
  };
}
