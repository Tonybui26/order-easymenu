/**
 * NEW CUSTOM PLUGIN IMPLEMENTATION
 *
 * These functions use our custom TCP socket plugin which provides:
 * 1. Proper timeout handling (no hanging connections)
 * 2. Automatic cleanup of failed connections
 * 3. No internal state corruption
 * 4. Instant reset capability
 */

// Import constants from existing file
const PRINTER_IP = "192.168.0.71"; // Your hardcoded printer IP
const PRINTER_PORT = 9100;

/**
 * Import our custom TCP socket plugin using Capacitor's registerPlugin
 */
import { registerPlugin } from "@capacitor/core";

// Register our custom plugin
const PrinterTcpSocketNew = registerPlugin("PrinterTcpSocket");

/**
 * Import ESC/POS formatting functions from existing printerUtils
 */
import {
  createEscPosCommands,
  formatOrderForPrintingWithESC_POS,
} from "./printerUtils.js";

/**
 * NEW: Enhanced print test using custom plugin
 *
 * @param {string} message - Optional custom message (default: uses sample order data)
 * @param {Object} printer - Printer configuration object with localIp and port
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printTestNew(message = null, printer = null) {
  let connectionId = null;

  try {
    // Use provided printer or fallback to hardcoded values
    const printerIp = printer?.localIp || PRINTER_IP;
    const printerPort = printer?.port || PRINTER_PORT;

    console.log(
      `🆕 NEW: Connecting to printer at ${printerIp}:${printerPort} using custom plugin`,
    );

    // Connect with custom plugin (has proper timeout and cleanup)
    const connectResult = await PrinterTcpSocketNew.connect({
      ipAddress: printerIp,
      port: printerPort,
      timeoutMs: 5000, // 5 second timeout
    });

    connectionId = connectResult.connectionId;
    console.log(`🆕 NEW: Connected with connection ID: ${connectionId}`);

    // Create sample order data for testing (same as original)
    const sampleOrder = {
      table: "Table 5",
      createdAt: new Date().toISOString(),
      paymentStatus: "Paid",
      pickupTime: "12:30 PM",
      customerName: "John Doe",
      customerPhone: "(555) 123-4567",
      customerEmail: "john.doe@example.com",
      items: [
        {
          quantity: 2,
          name: "Margherita Pizza",
          selectedVariants: [
            { groupName: "Size", optionName: "Large" },
            { groupName: "Crust", optionName: "Thin Crust" },
          ],
          selectedModifiers: [
            { groupName: "Extra Toppings", optionName: "Extra Cheese" },
          ],
        },
        {
          quantity: 1,
          name: "Caesar Salad",
          selectedVariants: [
            { groupName: "Dressing", optionName: "On the side" },
          ],
          selectedModifiers: [],
        },
        {
          quantity: 3,
          name: "Soft Drink",
          selectedVariants: [{ groupName: "Type", optionName: "Coca-Cola" }],
          selectedModifiers: [],
        },
      ],
    };

    const sampleOrderId = "TEST001";

    // Prepare print data
    let printData;
    if (message) {
      printData = createEscPosCommands(message);
    } else {
      // Use the same formatting as existing printOrder
      printData = formatOrderForPrintingWithESC_POS(sampleOrder, sampleOrderId);
    }

    // Send data to printer using custom plugin
    await PrinterTcpSocketNew.send({
      connectionId: connectionId,
      data: printData,
      encoding: "base64",
    });

    console.log(
      "🆕 NEW: Test print data sent successfully using custom plugin",
    );

    // Disconnect cleanly
    await PrinterTcpSocketNew.disconnect({
      connectionId: connectionId,
    });

    console.log("🆕 NEW: Disconnected cleanly from printer");

    return {
      success: true,
      message: message
        ? "Custom test message printed successfully using NEW plugin!"
        : "Sample order receipt printed successfully using NEW plugin!",
    };
  } catch (error) {
    console.error("🆕 NEW: Print error with custom plugin:", error);

    // Automatic cleanup - custom plugin handles this better
    if (connectionId) {
      try {
        await PrinterTcpSocketNew.disconnect({ connectionId });
        console.log("🆕 NEW: Emergency cleanup completed");
      } catch (cleanupError) {
        console.error("🆕 NEW: Cleanup error:", cleanupError);
      }
    }

    return {
      success: false,
      message: `NEW plugin print failed: ${error.message || "Unknown error"}`,
    };
  }
}

/**
 * NEW: Enhanced print order using custom plugin
 *
 * @param {Object} printData - The print data containing order, orderId, and printers
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printOrderNew(printData) {
  const { order, orderId, printers } = printData;
  let successfulPrints = 0;
  const totalPrinters = printers.length;
  const connectionIds = [];

  // Return early if no printers are provided
  if (totalPrinters === 0) {
    return {
      success: false,
      message: "No printers configured for printing",
    };
  }

  try {
    console.log(
      `🆕 NEW: Starting order print to ${totalPrinters} printer(s) using custom plugin`,
    );

    // Print to all configured printers
    for (const printer of printers) {
      if (printer._id && printer.localIp && printer.port && printer.isActive) {
        let connectionId = null;

        try {
          // Connect to printer using custom plugin
          const connectResult = await PrinterTcpSocketNew.connect({
            ipAddress: printer.localIp,
            port: printer.port,
            timeoutMs: 5000,
          });

          connectionId = connectResult.connectionId;
          connectionIds.push(connectionId); // Track for cleanup

          // Format order using ESC/POS (same as existing function)
          const printDocument = formatOrderForPrintingWithESC_POS(
            order,
            orderId,
          );

          // Send data to printer
          await PrinterTcpSocketNew.send({
            connectionId: connectionId,
            data: printDocument,
            encoding: "base64",
          });

          // Disconnect cleanly
          await PrinterTcpSocketNew.disconnect({
            connectionId: connectionId,
          });

          successfulPrints++;
          console.log(
            `🆕 NEW: Successfully printed to printer ${printer.name} (${printer._id}) using custom plugin`,
          );
        } catch (error) {
          console.error(
            `🆕 NEW: Failed to print to printer ${printer.name} (${printer._id}):`,
            error,
          );

          // Custom plugin handles cleanup automatically, but we'll be explicit
          if (connectionId) {
            try {
              await PrinterTcpSocketNew.disconnect({ connectionId });
            } catch (disconnectError) {
              console.error(
                "🆕 NEW: Error during emergency disconnect:",
                disconnectError,
              );
            }
          }
        }
      } else {
        console.warn(
          `🆕 NEW: Skipping printer ${printer.name || printer._id}: missing required fields or inactive`,
        );
      }
    }

    // Return results
    if (successfulPrints > 0) {
      return {
        success: true,
        message: `NEW plugin: Order printed successfully to ${successfulPrints}/${totalPrinters} printer(s)!`,
      };
    } else {
      return {
        success: false,
        message: `NEW plugin: Print failed - Could not print to any of the printers`,
      };
    }
  } catch (error) {
    console.error("🆕 NEW: Critical error in printOrderNew:", error);

    // Emergency cleanup of any connections that might be open
    if (connectionIds.length > 0) {
      try {
        for (const connId of connectionIds) {
          try {
            await PrinterTcpSocketNew.disconnect({ connectionId: connId });
          } catch (cleanupError) {
            // Ignore individual cleanup errors
          }
        }
      } catch (pluginError) {
        // Ignore plugin errors during emergency cleanup
      }
    }

    return {
      success: false,
      message: `NEW plugin: Critical print error - ${error.message || "Unknown error"}`,
    };
  }
}

/**
 * NEW: Instant reset function using custom plugin
 *
 * This function provides instant reset of all TCP connections
 * without the need for slow dummy connections.
 *
 * @returns {Promise<{success: boolean, message: string, stats: Object}>}
 */
export async function resetTcpPluginNew() {
  try {
    console.log("🆕 NEW: Starting instant TCP plugin reset...");

    // Get status before reset (for debugging)
    const statusBefore = await PrinterTcpSocketNew.getStatus();
    console.log("🆕 NEW: Status before reset:", statusBefore);

    // Perform instant reset
    const resetResult = await PrinterTcpSocketNew.resetAll();
    console.log("🆕 NEW: Reset result:", resetResult);

    // Get status after reset (for verification)
    const statusAfter = await PrinterTcpSocketNew.getStatus();
    console.log("🆕 NEW: Status after reset:", statusAfter);

    return {
      success: true,
      message: `NEW plugin: Instant reset completed! ${resetResult.message}`,
      stats: {
        connectionsCleared: resetResult.connectionsCleared,
        statusBefore: statusBefore,
        statusAfter: statusAfter,
      },
    };
  } catch (error) {
    console.error("🆕 NEW: Reset failed:", error);
    return {
      success: false,
      message: `NEW plugin: Reset failed - ${error.message || "Unknown error"}`,
      stats: null,
    };
  }
}

/**
 * NEW: Get connection status for debugging
 *
 * @returns {Promise<Object>} Current connection status
 */
export async function getPluginStatusNew() {
  try {
    const status = await PrinterTcpSocketNew.getStatus();
    console.log("🆕 NEW: Current plugin status:", status);
    return status;
  } catch (error) {
    console.error("🆕 NEW: Failed to get plugin status:", error);
    return {
      error: error.message,
      activeConnections: -1,
      connectionIds: [],
      platform: "unknown",
    };
  }
}
