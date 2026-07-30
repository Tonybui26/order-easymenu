import { registerPlugin } from "@capacitor/core";
import { formatTaxInvoiceReceiptForPrinter } from "./formatTaxInvoiceReceiptForPrinter";
import {
  imageUrlToEscPosRaster,
  prependCenteredLogoToEscPosBase64,
  PRINT_TEST_LOGO_MAX_WIDTH_DOTS,
} from "@/lib/printers/image/imageUrlToEscPosRaster";

const PrinterTcpSocketNew = registerPlugin("PrinterTcpSocket");

const DEFAULT_PORT = 9100;

/**
 * Send one TAX INVOICE receipt payload to a single printer.
 *
 * @param {Object} printer
 * @param {{ store: Object, order: Object, invoiceNo: string }} payload
 * @param {Object} [options]
 * @param {string} [options.logoUrl] - store logo URL to print centered at top
 * @param {number} [options.logoMaxWidthDots]
 * @param {(status: Object) => void} [options.onLogoStatus]
 */
export async function sendTaxInvoiceReceiptToPrinter(
  printer,
  payload,
  options = {},
) {
  let connectionId = null;
  const startTime = Date.now();

  const printerIp = printer?.localIp;
  const printerPort = printer?.port ?? DEFAULT_PORT;

  if (!printerIp) {
    return {
      success: false,
      message: "Receipt print failed: printer IP is required",
      duration: Date.now() - startTime,
    };
  }

  try {
    let printData = formatTaxInvoiceReceiptForPrinter(payload, printer);
    let logoStatus = { attempted: false, success: false };

    const logoUrl =
      options.logoUrl || payload?.store?.storeLogo || null;
    if (logoUrl) {
      logoStatus.attempted = true;
      try {
        const logoRaster = await imageUrlToEscPosRaster(logoUrl, {
          maxWidthDots:
            options.logoMaxWidthDots ?? PRINT_TEST_LOGO_MAX_WIDTH_DOTS,
        });
        printData = prependCenteredLogoToEscPosBase64(
          printData,
          logoRaster.bytes,
        );
        logoStatus = {
          attempted: true,
          success: true,
          bytes: logoRaster.bytes.length,
          width: logoRaster.width,
          height: logoRaster.height,
          blackPixels: logoRaster.blackPixels,
        };
        if (typeof options.onLogoStatus === "function") {
          options.onLogoStatus(logoStatus);
        }
      } catch (logoError) {
        logoStatus = {
          attempted: true,
          success: false,
          error: logoError?.message || String(logoError),
        };
        console.warn(
          "[Receipt] Could not print store logo, continuing without it:",
          logoStatus.error,
        );
        if (typeof options.onLogoStatus === "function") {
          options.onLogoStatus(logoStatus);
        }
      }
    }

    const connectResult = await PrinterTcpSocketNew.connect({
      ipAddress: printerIp,
      port: Number(printerPort),
      timeoutMs: options.timeoutMs ?? 5000,
    });

    connectionId = connectResult.connectionId;

    await PrinterTcpSocketNew.send({
      connectionId,
      data: printData,
      encoding: "base64",
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    await PrinterTcpSocketNew.disconnect({ connectionId });
    connectionId = null;

    const delayAfter = options.delayAfterDisconnect ?? 200;
    if (delayAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayAfter));
    }

    return {
      success: true,
      message: `Receipt printed to ${printer.name || printerIp}`,
      duration: Date.now() - startTime,
      logoStatus,
    };
  } catch (error) {
    console.error("[Receipt] Print error:", error);

    if (connectionId) {
      try {
        await PrinterTcpSocketNew.disconnect({ connectionId });
      } catch (cleanupError) {
        console.error("[Receipt] Cleanup error:", cleanupError);
      }
    }

    return {
      success: false,
      message: error.message || "Receipt print failed",
      duration: Date.now() - startTime,
    };
  }
}

export { DEFAULT_PORT };
