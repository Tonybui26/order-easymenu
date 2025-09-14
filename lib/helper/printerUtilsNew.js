/**
 * NEW CUSTOM PLUGIN IMPLEMENTATION
 *
 * These functions use our custom TCP socket plugin which provides:
 * 1. Proper timeout handling (no hanging connections)
 * 2. Automatic cleanup of failed connections
 * 3. No internal state corruption
 * 4. Instant reset capability
 */

/**
 * Import constants and functions from existing printerUtils
 */
import {
  PRINTER_IP,
  PRINTER_PORT,
  createEscPosCommands,
  formatOrderForPrintingWithESC_POS,
} from "./printerUtils.js";

/**
 * Import our custom TCP socket plugin using Capacitor's registerPlugin
 */
import { registerPlugin } from "@capacitor/core";

// Register our custom plugin
const PrinterTcpSocketNew = registerPlugin("PrinterTcpSocket");

/**
 * NEW: Enhanced print test using custom plugin
 *
 * @param {string} message - Optional custom message (default: uses sample order data)
 * @param {Object} printer - Printer configuration object with localIp and port
 * @param {Object} options - Additional options like delay
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printTestNew(
  message = null,
  printer = null,
  options = {},
) {
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

    // CRITICAL: Add small delay before disconnect to let printer process data
    // This prevents socket exhaustion on the printer side
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Disconnect cleanly
    await PrinterTcpSocketNew.disconnect({
      connectionId: connectionId,
    });

    console.log("🆕 NEW: Disconnected cleanly from printer");

    // CRITICAL: Add delay after disconnect to prevent printer socket exhaustion
    // This gives the printer time to fully close the socket on its end
    const delayAfter = options.delayAfterDisconnect || 200;
    if (delayAfter > 0) {
      console.log(
        `🆕 NEW: Waiting ${delayAfter}ms for printer socket cleanup...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayAfter));
    }

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

/**
 * NEW: Aggressive testing function with printer-friendly delays
 *
 * This function tests the exact scenario that was causing printer socket exhaustion:
 * - Multiple fake IP tests followed by real IP tests
 * - Includes proper delays to prevent overwhelming the printer
 *
 * @param {Object} realPrinter - Real printer configuration
 * @param {Object} fakePrinter - Fake printer configuration (for testing failures)
 * @param {number} cycles - Number of test cycles to run
 * @returns {Promise<Object>} Test results
 */
export async function aggressiveTestNew(realPrinter, fakePrinter, cycles = 3) {
  console.log(`🆕 NEW: Starting aggressive test with ${cycles} cycles...`);

  const results = {
    cycles: [],
    totalTests: 0,
    successfulTests: 0,
    failedTests: 0,
    summary: "",
  };

  try {
    for (let i = 0; i < cycles; i++) {
      console.log(`\n🆕 NEW: === CYCLE ${i + 1}/${cycles} ===`);

      const cycleResult = {
        cycle: i + 1,
        tests: [],
      };

      // Test 1: Real IP (should work)
      console.log(`🆕 NEW: Cycle ${i + 1} - Testing real IP...`);
      const realTest1 = await printTestNew(null, realPrinter, {
        delayAfterDisconnect: 300,
      });
      cycleResult.tests.push({ type: "real", result: realTest1 });
      results.totalTests++;
      if (realTest1.success) results.successfulTests++;
      else results.failedTests++;

      // Test 2: Fake IP (should fail cleanly)
      if (fakePrinter) {
        console.log(`🆕 NEW: Cycle ${i + 1} - Testing fake IP...`);
        const fakeTest = await printTestNew(null, fakePrinter, {
          delayAfterDisconnect: 500,
        });
        cycleResult.tests.push({ type: "fake", result: fakeTest });
        results.totalTests++;
        if (fakeTest.success) results.successfulTests++;
        else results.failedTests++;
      }

      // Test 3: Real IP again (this is the critical test)
      console.log(`🆕 NEW: Cycle ${i + 1} - Testing real IP again...`);
      const realTest2 = await printTestNew(null, realPrinter, {
        delayAfterDisconnect: 300,
      });
      cycleResult.tests.push({ type: "real_after_fake", result: realTest2 });
      results.totalTests++;
      if (realTest2.success) results.successfulTests++;
      else results.failedTests++;

      results.cycles.push(cycleResult);

      // Inter-cycle delay to let printer fully recover
      if (i < cycles - 1) {
        console.log(
          `🆕 NEW: Inter-cycle delay (1000ms) to let printer recover...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Generate summary
    results.summary = `Completed ${results.totalTests} tests: ${results.successfulTests} successful, ${results.failedTests} failed`;
    console.log(`\n🆕 NEW: AGGRESSIVE TEST COMPLETE`);
    console.log(`🆕 NEW: ${results.summary}`);

    return results;
  } catch (error) {
    console.error("🆕 NEW: Aggressive test failed:", error);
    results.error = error.message;
    return results;
  }
}
