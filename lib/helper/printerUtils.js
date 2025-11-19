import { PrinterTcpSocket } from "../../printer-tcp-socket/src/index.js";
import { Network } from "@capacitor/network";

/**
 * Generates IP ranges for network scanning based on detected subnet
 * @param {string} subnet - The detected subnet (e.g., "192.168.1.x")
 * @param {string} mode - "full" for all 255 IPs, "common" for most likely printer IPs
 * @returns {Array<string>} Array of IP addresses to test
 */
function generateIPRangesFromSubnet(subnet, mode = "common") {
  // Extract the base subnet (first 3 octets)
  const baseSubnet = subnet.split(".");
  if (baseSubnet.length < 3) {
    // Fallback to common ranges if subnet format is unexpected
    return [
      "192.168.1.100",
      "192.168.1.200",
      "192.168.0.100",
      "192.168.0.200",
      "192.168.1.150",
      "192.168.0.150",
      "192.168.1.101",
      "192.168.1.102",
      "192.168.0.101",
      "192.168.0.102",
    ];
  }

  const base = baseSubnet.slice(0, 3).join(".");

  if (mode === "full") {
    // Generate comprehensive IP range for the detected subnet (0-255)
    const ipRange = [];

    // Generate all IPs from 0 to 255 in the detected subnet
    for (let i = 0; i <= 255; i++) {
      ipRange.push(`${base}.${i}`);
    }

    // Return all 255 IPs for full coverage
    // Note: This will take longer but provides complete network scanning
    return ipRange;
  } else {
    // Generate most common printer/device IPs for the detected subnet
    const commonIPs = [];

    // Router and gateway IPs
    commonIPs.push(`${base}.1`); // Usually router

    // Common printer/device ranges
    for (let i = 100; i <= 200; i += 10) {
      commonIPs.push(`${base}.${i}`);
    }

    // Specific common IPs
    commonIPs.push(
      `${base}.101`,
      `${base}.102`,
      `${base}.150`,
      `${base}.201`,
      `${base}.202`,
      `${base}.250`,
      `${base}.251`,
      `${base}.252`,
      `${base}.253`,
      `${base}.254`,
    );

    // Remove duplicates and return
    return [...new Set(commonIPs)];
  }
}

/**
 * Gets the current subnet by checking network interface
 * @returns {Promise<string>} Current subnet (e.g., "192.168.1.x")
 */
async function getCurrentSubnet() {
  try {
    // Get network status to determine if we're connected
    const networkStatus = await Network.getStatus();

    if (networkStatus.connected) {
      // Try to get local IP by attempting connections to common gateways
      // This will help us determine the subnet we're on
      const testIPs = [
        "192.168.1.1", // Common router IP
        "192.168.0.1", // Alternative router IP
        "10.0.0.1", // Alternative subnet
        "172.16.1.1", // Alternative subnet
      ];

      for (const testIP of testIPs) {
        try {
          // Quick test to see if we can reach this gateway
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 500);

          console.log("🔍 Testing IP:", testIP);

          await fetch(`http://${testIP}`, {
            method: "HEAD",
            mode: "no-cors",
            signal: controller.signal,
            cache: "no-cache",
          });

          clearTimeout(timeoutId);

          // If we reach here, we found a reachable gateway
          // Extract subnet from the IP
          const subnet = testIP.split(".").slice(0, 3).join(".");
          return `${subnet}.x`;
        } catch (error) {
          // Continue to next IP
          continue;
        }
      }

      // If no gateways responded, try to infer from candidate IPs
      return "192.168.1.x (inferred)";
    } else {
      return "Not connected";
    }
  } catch (error) {
    return "Unknown";
  }
}

export const PRINTER_IP = "192.168.0.71"; // Your hardcoded printer IP
export const PRINTER_PORT = 9100;

/**
 * Removes Vietnamese diacritics (accents) from text
 * Converts Vietnamese characters to their ASCII equivalents
 * Example: "Việt Nam" → "Viet Nam", "Phở" → "Pho"
 * @param {string} text - Text with Vietnamese diacritics
 * @returns {string} - Text without diacritics
 */
export function removeVietnameseDiacritics(text) {
  if (!text) return text;

  // Vietnamese diacritics mapping to ASCII equivalents
  const diacriticsMap = {
    // a variants
    á: "a",
    à: "a",
    ả: "a",
    ã: "a",
    ạ: "a",
    ă: "a",
    ắ: "a",
    ằ: "a",
    ẳ: "a",
    ẵ: "a",
    ặ: "a",
    â: "a",
    ấ: "a",
    ầ: "a",
    ẩ: "a",
    ẫ: "a",
    ậ: "a",
    // e variants
    é: "e",
    è: "e",
    ẻ: "e",
    ẽ: "e",
    ẹ: "e",
    ê: "e",
    ế: "e",
    ề: "e",
    ể: "e",
    ễ: "e",
    ệ: "e",
    // i variants
    í: "i",
    ì: "i",
    ỉ: "i",
    ĩ: "i",
    ị: "i",
    // o variants
    ó: "o",
    ò: "o",
    ỏ: "o",
    õ: "o",
    ọ: "o",
    ô: "o",
    ố: "o",
    ồ: "o",
    ổ: "o",
    ỗ: "o",
    ộ: "o",
    ơ: "o",
    ớ: "o",
    ờ: "o",
    ở: "o",
    ỡ: "o",
    ợ: "o",
    // u variants
    ú: "u",
    ù: "u",
    ủ: "u",
    ũ: "u",
    ụ: "u",
    ư: "u",
    ứ: "u",
    ừ: "u",
    ử: "u",
    ữ: "u",
    ự: "u",
    // y variants
    ý: "y",
    ỳ: "y",
    ỷ: "y",
    ỹ: "y",
    ỵ: "y",
    // d variant
    đ: "d",
    // Uppercase variants
    Á: "A",
    À: "A",
    Ả: "A",
    Ã: "A",
    Ạ: "A",
    Ă: "A",
    Ắ: "A",
    Ằ: "A",
    Ẳ: "A",
    Ẵ: "A",
    Ặ: "A",
    Â: "A",
    Ấ: "A",
    Ầ: "A",
    Ẩ: "A",
    Ẫ: "A",
    Ậ: "A",
    É: "E",
    È: "E",
    Ẻ: "E",
    Ẽ: "E",
    Ẹ: "E",
    Ê: "E",
    Ế: "E",
    Ề: "E",
    Ể: "E",
    Ễ: "E",
    Ệ: "E",
    Í: "I",
    Ì: "I",
    Ỉ: "I",
    Ĩ: "I",
    Ị: "I",
    Ó: "O",
    Ò: "O",
    Ỏ: "O",
    Õ: "O",
    Ọ: "O",
    Ô: "O",
    Ố: "O",
    Ồ: "O",
    Ổ: "O",
    Ỗ: "O",
    Ộ: "O",
    Ơ: "O",
    Ớ: "O",
    Ờ: "O",
    Ở: "O",
    Ỡ: "O",
    Ợ: "O",
    Ú: "U",
    Ù: "U",
    Ủ: "U",
    Ũ: "U",
    Ụ: "U",
    Ư: "U",
    Ứ: "U",
    Ừ: "U",
    Ử: "U",
    Ữ: "U",
    Ự: "U",
    Ý: "Y",
    Ỳ: "Y",
    Ỷ: "Y",
    Ỹ: "Y",
    Ỵ: "Y",
    Đ: "D",
  };

  return text
    .split("")
    .map((char) => diacriticsMap[char] || char)
    .join("");
}

/**
 * Creates ESC/POS commands for printing text
 * @param {string} text - The text to print
 * @returns {string} - Base64 encoded ESC/POS commands
 */
export function createEscPosCommands(text) {
  const commands = [];

  // Initialize printer (ESC @)
  commands.push(0x1b, 0x40);

  // Center alignment (ESC a 1)
  commands.push(0x1b, 0x61, 0x01);

  // Double width/height for header (ESC ! 48)
  commands.push(0x1b, 0x21, 0x30);

  // Add newline and text
  commands.push(0x0a); // newline

  // Convert text to bytes
  const textBytes = new TextEncoder().encode(text);
  commands.push(...textBytes);

  // Add newlines
  commands.push(0x0a, 0x0a);

  // Reset to normal size (ESC ! 0)
  commands.push(0x1b, 0x21, 0x00);

  // Footer separator
  commands.push(0x0a);
  commands.push(
    ...new TextEncoder().encode("------------------------------------------"),
  );
  commands.push(0x0a);

  // Bold on (ESC E 1)
  commands.push(0x1b, 0x45, 0x01);
  commands.push(0x0a);
  commands.push(...new TextEncoder().encode("powered by goeasy.menu"));
  commands.push(0x0a);

  // Bold off (ESC E 0)
  commands.push(0x1b, 0x45, 0x00);

  // Feed paper (ESC d 3)
  commands.push(0x1b, 0x64, 0x03);

  // Cut paper (GS V A 3)
  commands.push(0x1d, 0x56, 0x41, 0x03);

  // Convert to Uint8Array and then to Base64
  const uint8Array = new Uint8Array(commands);
  const binaryString = String.fromCharCode.apply(null, uint8Array);
  return btoa(binaryString);
}

// Add this at the top of printerUtils.js
let activeConnections = new Set();
let pluginStateCorrupted = false; // ✅ Add this missing declaration

/**
 * Sends a test print to the configured printer using the same layout as printOrder
 * @param {string} message - Optional custom message (default: uses sample order data)
 * @param {Object} printer - Printer configuration object with localIp and port
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printTest(message = null, printer = null) {
  let clientId;

  try {
    // Use provided printer or fallback to hardcoded values
    const printerIp = printer?.localIp || PRINTER_IP;
    const printerPort = printer?.port || PRINTER_PORT;

    console.log(`Connecting to printer at ${printerIp}:${printerPort}`);

    // Check for existing connections
    if (activeConnections.size > 0) {
      console.log(
        `⚠️ ${activeConnections.size} active connections detected, cleaning up...`,
      );
      await cleanupAllConnections();
    }

    // Add timeout wrapper
    const connectPromise = PrinterTcpSocket.connect({
      ipAddress: printerIp,
      port: printerPort,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Connection timeout after 5 seconds")),
        5000,
      ),
    );

    const connectResult = await Promise.race([connectPromise, timeoutPromise]);

    clientId = connectResult.connectionId;
    // Track active connection
    activeConnections.add(clientId);
    console.log(`Connected with client ID: ${clientId}`);

    // Create sample order data for testing
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

    // If a custom message is provided, create a simple test print
    let printData;
    if (message) {
      printData = createEscPosCommands(message);
    } else {
      // Use the same formatting as printOrder
      printData = formatOrderForPrintingWithESC_POS(sampleOrder, sampleOrderId);
    }

    // Send data to printer
    await PrinterTcpSocket.send({
      connectionId: clientId,
      data: printData,
      encoding: "base64",
    });

    console.log("Test print data sent successfully");

    // Disconnect from printer
    await PrinterTcpSocket.disconnect({
      connectionId: clientId,
    });

    // Remove from active connections
    activeConnections.delete(clientId);

    return {
      success: true,
      message: message
        ? "Custom test message printed successfully!"
        : "Sample order receipt printed successfully!",
    };
  } catch (error) {
    console.error("Print error:", error);

    // Try to disconnect if we have a client ID
    if (clientId) {
      try {
        await PrinterTcpSocket.disconnect({ connectionId: clientId });
        activeConnections.delete(clientId);
      } catch (disconnectError) {
        console.error("Error disconnecting:", disconnectError);
      }
    }

    return {
      success: false,
      message: `Print failed: ${error.message || "Unknown error"}`,
    };
  }
}

// Fixed forcePluginReset with timeout
async function forcePluginReset() {
  console.log("🔧 Starting TCP plugin reset...");

  try {
    // Method 1: Try to create multiple dummy connections with timeout
    const resetPromises = [];

    for (let i = 0; i < 3; i++) {
      // Create dummy connection with timeout
      const dummyPromise = Promise.race([
        PrinterTcpSocket.connect({
          ipAddress: "127.0.0.1", // localhost
          port: 1, // Invalid port - guaranteed to fail
        }),
        new Promise(
          (_, reject) =>
            setTimeout(() => reject(new Error("Dummy timeout")), 1000), // ✅ 1 second timeout
        ),
      ]).catch(() => {
        // Expected to fail - this forces plugin to cycle through states
        console.log(`🔄 Dummy connection ${i + 1} failed (expected)`);
      });

      resetPromises.push(dummyPromise);

      // Small delay between dummy connections
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Wait for all dummy connections to fail (max 3 seconds total)
    await Promise.allSettled(resetPromises);

    // Method 2: Force garbage collection if available
    if (typeof global !== "undefined" && global.gc) {
      global.gc();
      console.log("🗑️ Forced garbage collection");
    }

    // Method 3: Clear any potential internal timeouts
    await new Promise((resolve) => setTimeout(resolve, 200)); // ✅ Reduced from 500ms

    console.log("✅ TCP plugin reset completed");
  } catch (error) {
    console.log("⚠️ Plugin reset had issues (might be normal):", error.message);
    // Don't throw - reset might still have worked
  }
}

// Fixed resetTcpPlugin function
export async function resetTcpPlugin() {
  console.log("🔄 Manual TCP plugin reset requested...");

  try {
    await forcePluginReset();
    pluginStateCorrupted = false; // ✅ Now this variable exists
    console.log("✅ Manual TCP plugin reset completed successfully");
  } catch (error) {
    console.error("❌ Manual TCP plugin reset failed:", error);
    throw error; // Re-throw so toast.promise shows the error
  }
}

async function cleanupAllConnections() {
  const cleanupPromises = Array.from(activeConnections).map(
    async (clientId) => {
      try {
        await PrinterTcpSocket.disconnect({ connectionId: clientId });
        console.log(`🔌 Cleaned up connection ${clientId}`);
      } catch (error) {
        console.error(
          `⚠️ Failed to cleanup connection ${clientId}:`,
          error.message,
        );
      }
    },
  );

  await Promise.allSettled(cleanupPromises);
  activeConnections.clear();
}

/**
 * Prints a full order receipt using printData structure
 * @param {Object} printData - The print data containing order, orderId, and printers
 * @param {Object} printData.order - The order data
 * @param {string} printData.orderId - The order ID
 * @param {Array} printData.printers - Array of printer configurations
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printOrder(printData) {
  const { order, orderId, printers } = printData;
  let clientId;
  let successfulPrints = 0;
  const totalPrinters = printers.length;

  // Return early if no printers are provided
  if (totalPrinters === 0) {
    return {
      success: false,
      message: "No printers configured for printing",
    };
  }

  // Print to all configured printers
  for (const printer of printers) {
    if (printer._id && printer.localIp && printer.port && printer.isActive) {
      try {
        // Connect to printer
        const connectResult = await PrinterTcpSocket.connect({
          ipAddress: printer.localIp,
          port: printer.port,
        });

        clientId = connectResult.connectionId;

        // Format order using ESC/POS
        const printDocument = formatOrderForPrintingWithESC_POS(order, orderId);

        // Send data to printer
        await PrinterTcpSocket.send({
          connectionId: clientId,
          data: printDocument,
          encoding: "base64",
        });

        // Disconnect from printer
        await PrinterTcpSocket.disconnect({
          connectionId: clientId,
        });

        successfulPrints++;
        console.log(
          `Successfully printed to printer ${printer.name} (${printer._id})`,
        );
      } catch (error) {
        console.error(
          `Failed to print to printer ${printer.name} (${printer._id}):`,
          error,
        );

        // Try to disconnect if we have a client ID
        if (clientId) {
          try {
            await PrinterTcpSocket.disconnect({ connectionId: clientId });
          } catch (disconnectError) {
            console.error("Error disconnecting:", disconnectError);
          }
        }
      }
    } else {
      console.warn(
        `Skipping printer ${printer.name || printer._id}: missing required fields or inactive`,
      );
    }
  }

  if (successfulPrints > 0) {
    return {
      success: true,
      message: `Order printed successfully to ${successfulPrints}/${totalPrinters} printer(s)!`,
    };
  } else {
    return {
      success: false,
      message: `Print failed: Could not print to any of the printers`,
    };
  }
}

export function formatOrderForPrintingWithESC_POS(order, orderId) {
  const commands = [];

  // Helper function to add bytes to commands array
  const addBytes = (bytes) => {
    if (Array.isArray(bytes)) {
      commands.push(...bytes);
    } else {
      commands.push(bytes);
    }
  };

  // Helper function to add text as bytes
  const addText = (text) => {
    const textBytes = new TextEncoder().encode(text);
    commands.push(...textBytes);
  };

  // Initialize printer (ESC @)
  addBytes([0x1b, 0x40]);

  // Center alignment and double width/height for header
  addBytes([0x1b, 0x61, 0x01]); // ESC a 1 - Center alignment
  addBytes([0x1b, 0x21, 0x30]); // ESC ! 48 - Double width and height

  // Store header
  addText("\n");
  addText(`#${orderId}\n`);

  // Order info with bold
  addBytes([0x1b, 0x45, 0x01]); // ESC E 1 - Bold on
  addText(`*** ${order.table} ***\n\n`);
  addBytes([0x1b, 0x45, 0x00]); // ESC E 0 - Bold off

  // Reset to normal size
  addBytes([0x1b, 0x21, 0x00]); // ESC ! 0 - Normal size

  if (order.table.toLowerCase() !== "takeaway") {
    addText(`${new Date(order.createdAt).toLocaleString()}\n`);
    addText("\n------------------------------------------\n\n");
  } else {
    // Left alignment for takeaway orders
    addBytes([0x1b, 0x61, 0x00]); // ESC a 0 - Left alignment
    addText(
      `   Online Order (${new Date(order.createdAt).toLocaleString()})\n`,
    );
    addText(`   Payment: ${order.paymentStatus}\n`);
    addText(`   Pickup: ${order.pickupTime}\n`);
    addText(`   for ${order.customerName} | ${order.customerPhone}\n`);
    addText(`   ${order.customerEmail}\n`);
    addBytes([0x1b, 0x61, 0x01]); // ESC a 1 - Center alignment
    addText("\n------------------------------------------\n\n");
  }

  // Items
  order.items.forEach((item) => {
    // Bold and double height for item name
    addBytes([0x1b, 0x45, 0x01]); // ESC E 1 - Bold on
    addBytes([0x1b, 0x21, 0x10]); // ESC ! 16 - Double height
    addBytes([0x1b, 0x61, 0x00]); // ESC a 0 - Left alignment
    addText(`   ${item.quantity} x ${removeVietnameseDiacritics(item.name)}\n`);
    addBytes([0x1b, 0x21, 0x00]); // ESC ! 0 - Reset to normal size
    addBytes([0x1b, 0x45, 0x00]); // ESC E 0 - Bold off

    // Variants
    if (item.selectedVariants) {
      addBytes([0x1b, 0x21, 0x10]); // ESC ! 16 - Double height
      item.selectedVariants.forEach((variant) => {
        addText(
          `       ${removeVietnameseDiacritics(variant.groupName)}: ${removeVietnameseDiacritics(variant.optionName)}\n`,
        );
      });
      addBytes([0x1b, 0x21, 0x00]); // ESC ! 0 - Reset to normal size
    }

    // Modifiers
    if (item.selectedModifiers) {
      addBytes([0x1b, 0x21, 0x10]); // ESC ! 16 - Double height
      item.selectedModifiers.forEach((modifier) => {
        addText(
          `       ${removeVietnameseDiacritics(modifier.groupName)}: ${removeVietnameseDiacritics(modifier.optionName)}\n`,
        );
      });
      addBytes([0x1b, 0x21, 0x00]); // ESC ! 0 - Reset to normal size
    }

    addText("\n");
  });

  // Footer
  addBytes([0x1b, 0x61, 0x01]); // ESC a 1 - Center alignment
  addText("\n------------------------------------------\n");
  addBytes([0x1b, 0x45, 0x01]); // ESC E 1 - Bold on
  addText("\npowered by goeasy.menu\n");
  addBytes([0x1b, 0x45, 0x00]); // ESC E 0 - Bold off

  // Feed paper and cut
  addBytes([0x1b, 0x64, 0x03]); // ESC d 3 - Feed 3 lines
  addBytes([0x1d, 0x56, 0x41, 0x03]); // GS V A 3 - Cut paper

  // Convert to Uint8Array and then to Base64
  const uint8Array = new Uint8Array(commands);
  const binaryString = String.fromCharCode.apply(null, uint8Array);
  return btoa(binaryString);
}

/**
 * Tests socket connection with timeout for printer validation (Mobile-Optimized)
 * @param {string} ip - IP address to test
 * @param {number} port - Port to test
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function testSocketConnection(ip, port) {
  return new Promise((resolve) => {
    let resolved = false;
    let clientId = null;
    let timeoutId = null;

    // Cleanup function to ensure proper resource management
    const cleanup = async (result) => {
      if (resolved) return; // Prevent multiple cleanup calls
      resolved = true;

      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Disconnect socket if we have a client ID
      if (clientId) {
        try {
          await PrinterTcpSocket.disconnect({ connectionId: clientId });
          console.log(`🔌 Socket ${ip}:${port} disconnected cleanly`);
        } catch (disconnectError) {
          console.warn(
            `⚠️ Disconnect warning for ${ip}:${port}:`,
            disconnectError.message,
          );
          // Don't throw - we still want to resolve with the connection result
        }
        clientId = null;
      }

      resolve(result);
    };

    // Set timeout for connection test (mobile-friendly)
    timeoutId = setTimeout(() => {
      console.log(`⏰ Connection timeout for ${ip}:${port} after 3000ms`);
      cleanup(false);
    }, 3000); // 3 second timeout - better for mobile networks

    // Start connection attempt
    PrinterTcpSocket.connect({
      ipAddress: ip,
      port: port,
    })
      .then(async (connectResult) => {
        if (!resolved) {
          clientId = connectResult.connectionId;
          console.log(`✅ Connected to ${ip}:${port}, client: ${clientId}`);

          // Small delay to ensure connection is stable (important for mobile)
          await new Promise((r) => setTimeout(r, 50));

          await cleanup(true);
        }
      })
      .catch(async (error) => {
        if (!resolved) {
          console.log(`❌ Connection failed for ${ip}:${port}:`, error.message);
          await cleanup(false);
        }
      });
  });
}

/**
 * HTTP-based "ping" to check if device is reachable (mobile-friendly alternative to ICMP)
 * @param {string} ip - IP address to ping
 * @param {number} timeout - Timeout in milliseconds
 * @param {Function} onLog - Optional logging callback for UI
 * @returns {Promise<{success: boolean, port?: number, responseTime?: number, details: string}>}
 */
async function httpPing(ip, timeout = 1000, onLog = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const log = (message) => {
    console.log(message);
    if (onLog) onLog(message);
  };

  try {
    log(`📡 HTTP ping to ${ip}...`);

    // Only test port 9100 (standard printer port)
    const port = 80;

    try {
      log(`  🔍 Testing ${ip}:${port}...`);
      const startTime = Date.now();

      const response = await fetch(`http://${ip}:${port}`, {
        method: "HEAD",
        mode: "no-cors", // Important for mobile CORS
        signal: controller.signal,
        cache: "no-cache",
      });

      const responseTime = Date.now() - startTime;
      log(`✅ HTTP ping SUCCESS: ${ip}:${port} responded in ${responseTime}ms`);
      clearTimeout(timeoutId);
      return {
        success: true,
        port: port,
        responseTime: responseTime,
        details: `Responded on port ${port} in ${responseTime}ms`,
      };
    } catch (error) {
      log(`  ❌ ${ip}:${port} failed: ${error.message}`);
      return {
        success: false,
        details: `Port ${port} failed: ${error.message}`,
      };
    }
  } catch (error) {
    log(`❌ HTTP ping ERROR for ${ip}: ${error.message}`);
    return {
      success: false,
      details: `Error: ${error.message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Hybrid discovery: HTTP ping first, then socket test only reachable IPs
 * @param {Object} options - Discovery options
 * @param {boolean} options.includeExtendedPorts - Whether to test extended ports
 * @param {Function} options.onProgress - Progress callback (current, total, found)
 * @returns {Promise<{success: boolean, printers: Array, message: string}>}
 */
export async function discoverPrintersHybrid({
  includeExtendedPorts = false,
  onProgress = null,
  onLog = null,
  scanSpeed = "fast", // "fast", "normal", "thorough"
} = {}) {
  const startTime = Date.now();
  const timings = {
    start: new Date().toISOString(),
    httpPing: 0,
    socketTest: 0,
    total: 0,
  };

  try {
    console.log(`\n🚀 Starting HYBRID printer discovery at ${timings.start}`);
    console.log(
      `📋 Configuration: Extended Ports=${includeExtendedPorts}, Scan Speed=${scanSpeed}`,
    );
    if (onLog)
      onLog(
        `📋 Scan Configuration: Extended Ports=${includeExtendedPorts}, Scan Speed=${scanSpeed}`,
      );

    // Check network status first
    const networkStatus = await Network.getStatus();
    console.log("🌐 Network status:", networkStatus);

    if (!networkStatus.connected) {
      throw new Error("No network connection available");
    }

    const discoveredPrinters = [];

    // Step 1: HTTP Ping Phase (Fast, no socket exhaustion)
    const pingStart = Date.now();
    console.log("\n📡 Phase 1: HTTP ping sweep...");
    // Get current subnet and log it
    const currentSubnet = await getCurrentSubnet();
    console.log(`🔍 Current subnet: ${currentSubnet}`);
    if (onLog) onLog(`🔍 Current subnet: ${currentSubnet}`);
    // Generate IP ranges based on detected subnet and user preference
    const ipMode = scanSpeed === "thorough" ? "full" : "common";
    const candidateIPs = generateIPRangesFromSubnet(currentSubnet, ipMode);
    // log list of ips to test
    console.log(`🔍 IPs to test: ${candidateIPs}`);
    if (onLog) onLog(`🔍 IPs to test: ${candidateIPs}`);

    const reachableIPs = [];

    // Ping IPs sequentially to prevent router overload
    console.log(
      `📡 Testing ${candidateIPs.length} IPs with sequential HTTP ping...`,
    );
    const pingResults = [];

    for (let i = 0; i < candidateIPs.length; i++) {
      const ip = candidateIPs[i];

      // Test one IP at a time
      const pingResult = await httpPing(ip, 800, onLog);
      pingResults.push({ ip, pingResult });

      // Update progress
      if (onProgress) {
        // Phase 1: HTTP ping progress (0 to candidateIPs.length)
        onProgress(i + 1, candidateIPs.length, 0);
      }

      // Adjust delay based on scan speed preference
      if (i < candidateIPs.length - 1) {
        let delay = 100; // default delay

        switch (scanSpeed) {
          case "fast":
            delay = 50; // 50ms between requests (faster but more aggressive)
            break;
          case "normal":
            delay = 100; // 100ms between requests (balanced)
            break;
          case "thorough":
            delay = 200; // 200ms between requests (gentler on network)
            break;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Collect reachable IPs
    for (const { ip, pingResult } of pingResults) {
      if (pingResult.success) {
        reachableIPs.push(ip);
        console.log(`✅ Reachable device found: ${ip} - ${pingResult.details}`);
        if (onLog)
          onLog(`✅ Reachable device found: ${ip} - ${pingResult.details}`);
      } else if (pingResult.details.includes("Failed to fetch")) {
        // "Failed to fetch" means device responded but not with valid HTTP
        // This is common for printers and other non-HTTP devices
        reachableIPs.push(ip);
        console.log(
          `✅ Device reachable (non-HTTP): ${ip} - ${pingResult.details}`,
        );
        if (onLog)
          onLog(
            `✅ Device reachable (non-HTTP): ${ip} - ${pingResult.details}`,
          );
      } else {
        console.log(`❌ Device not reachable: ${ip} - ${pingResult.details}`);
        if (onLog)
          onLog(`❌ Device not reachable: ${ip} - ${pingResult.details}`);
      }
    }

    timings.httpPing = Date.now() - pingStart;
    console.log(`📡 HTTP ping phase completed in ${timings.httpPing}ms`);
    console.log(
      `🎯 Found ${reachableIPs.length} reachable devices out of ${candidateIPs.length} tested`,
    );

    // Log phase completion
    if (onLog) {
      onLog(
        `📡 HTTP ping phase completed: ${reachableIPs.length}/${candidateIPs.length} devices reachable`,
      );
    }

    // Step 2: Socket Test Phase (Only test reachable IPs)
    const socketStart = Date.now();
    console.log("\n🔌 Phase 2: Socket testing reachable devices...");

    if (reachableIPs.length === 0) {
      console.log("⚠️ No reachable devices found, skipping socket tests");
    } else {
      // Test only reachable IPs with socket connections (minimal TCP usage)
      for (let i = 0; i < reachableIPs.length; i++) {
        const ip = reachableIPs[i];

        try {
          console.log(
            `🔌 Socket testing ${ip}:9100 (${i + 1}/${reachableIPs.length})`,
          );

          const isReachable = await testSocketConnection(ip, 9100);
          if (isReachable) {
            console.log(`✅ Found printer at ${ip}:9100`);

            const printer = {
              ip: ip,
              localIp: ip,
              port: 9100,
              name:
                ip === "192.168.1.202" ? "Epson Printer" : `Printer at ${ip}`,
              openPorts: [9100],
              isLikelyPrinter: true,
              confidence: ip === "192.168.1.202" ? 95 : 85,
              timestamp: new Date().toISOString(),
              serviceType: "hybrid-discovery",
              hostname: ip,
              discoveryMethod: "http-ping + socket",
            };

            // Test additional ports if extended mode is enabled
            if (includeExtendedPorts) {
              const extendedPorts = [9101, 515, 631];
              for (const port of extendedPorts) {
                try {
                  const isOpen = await testSocketConnection(ip, port);
                  if (isOpen) {
                    printer.openPorts.push(port);
                    console.log(`✅ Additional port found: ${ip}:${port}`);
                  }
                } catch (error) {
                  // Continue to next port
                }
              }
            }

            discoveredPrinters.push(printer);
          } else {
            console.log(
              `❌ Socket test failed for ${ip}:9100 (device reachable but not a printer)`,
            );
          }
        } catch (error) {
          console.log(`❌ Error testing ${ip}:`, error.message);
        }

        // Update progress
        if (onProgress) {
          onProgress(
            candidateIPs.length + i + 1,
            candidateIPs.length + reachableIPs.length,
            discoveredPrinters.length,
          );
        }

        // Minimal delay between socket tests (we have fewer to test now)
        if (i < reachableIPs.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    timings.socketTest = Date.now() - socketStart;
    timings.total = Date.now() - startTime;

    // Log results
    console.log("\n" + "=".repeat(50));
    console.log("📊 HYBRID DISCOVERY RESULTS SUMMARY");
    console.log("=".repeat(50));
    console.log(
      `⏱️  Total time: ${timings.total}ms (${(timings.total / 1000).toFixed(1)}s)`,
    );
    console.log(`📡 HTTP ping time: ${timings.httpPing}ms`);
    console.log(`🔌 Socket test time: ${timings.socketTest}ms`);
    console.log(
      `🎯 Reachable devices: ${reachableIPs.length}/${candidateIPs.length}`,
    );
    console.log(`🖨️  Printers found: ${discoveredPrinters.length}`);

    if (discoveredPrinters.length > 0) {
      console.log("\n🖨️  Discovered Printers:");
      discoveredPrinters.forEach((printer, index) => {
        console.log(
          `  ${index + 1}. ${printer.name} (${printer.ip}:${printer.port})`,
        );
        console.log(`     Discovery: ${printer.discoveryMethod}`);
        console.log(`     Ports: ${printer.openPorts.join(", ")}`);
        console.log(`     Confidence: ${printer.confidence}%`);
      });
    } else {
      console.log("\n⚠️  No printers found on tested devices.");
      console.log("💡 This could mean:");
      console.log("   - Your printer uses a different IP address");
      console.log("   - Printer is not on the same network");
      console.log("   - Printer is turned off or in sleep mode");
      console.log("   - Use 'Add Manually' to enter specific IP address");
    }

    console.log("=".repeat(50) + "\n");

    return {
      success: true,
      printers: discoveredPrinters,
      message:
        discoveredPrinters.length > 0
          ? `Found ${discoveredPrinters.length} printer(s) via hybrid discovery`
          : "No printers found. Use manual entry instead.",
      timings: timings,
      reachableDevices: reachableIPs.length,
      totalTested: candidateIPs.length,
    };
  } catch (error) {
    timings.total = Date.now() - startTime;
    console.log(
      `❌ Hybrid discovery error after ${timings.total}ms:`,
      error.message,
    );

    return {
      success: false,
      printers: [],
      message: `Discovery failed: ${error.message || "Unknown error"}`,
      timings: timings,
    };
  }
}

/**
 * Discovers printers using simple socket connection testing
 * @param {Object} options - Discovery options
 * @param {boolean} options.includeExtendedPorts - Whether to test extended ports
 * @param {Function} options.onProgress - Progress callback (current, total, found)
 * @returns {Promise<{success: boolean, printers: Array, message: string}>}
 */
export async function discoverPrinters({
  includeExtendedPorts = false,
  onProgress = null,
} = {}) {
  const startTime = Date.now();
  const timings = {
    start: new Date().toISOString(),
    discovery: 0,
    total: 0,
  };

  try {
    console.log(`\n🚀 Starting simple printer discovery at ${timings.start}`);
    console.log(`📋 Configuration: Extended Ports=${includeExtendedPorts}`);

    // Check network status first
    const networkStatus = await Network.getStatus();
    console.log("🌐 Network status:", networkStatus);

    if (!networkStatus.connected) {
      throw new Error("No network connection available");
    }

    const discoveryStart = Date.now();
    console.log("\n🔍 Testing popular printer IP addresses...");

    const discoveredPrinters = [];

    // Popular printer IP addresses to test (your Epson first)
    const printerIPs = [
      // Common printer IPs (prioritized list) - uncommented a few for testing
      "192.168.1.100",
      "192.168.1.200",
      "192.168.1.202",
      "192.168.0.100",
      // // Rest commented out for now
      // "192.168.1.150",
      // "192.168.0.200",
      // "192.168.0.150",

      // // Router/Gateway IPs (some printers use these)
      // "192.168.1.1",
      // "192.168.0.1",

      // // Extended common range
      // "192.168.1.101",
      // "192.168.1.102",
      // "192.168.1.201",
      // "192.168.0.101",
      // "192.168.0.102",
      // "192.168.0.201",

      // // Alternative ranges
      // "10.0.0.100",
      // "10.0.0.200",
      // "10.0.1.100",
      // "172.16.1.100",
      // "172.16.1.200",
    ];

    const totalTests = printerIPs.length;
    let completedTests = 0;

    console.log(`🔍 Testing ${totalTests} popular printer IPs...`);
    console.log(`📋 IPs to test:`, printerIPs);

    // Test each IP sequentially to avoid socket exhaustion
    for (let i = 0; i < printerIPs.length; i++) {
      const ip = printerIPs[i];

      try {
        console.log(`🔌 Testing ${ip}:9100 (${i + 1}/${totalTests})`);

        const isReachable = await testSocketConnection(ip, 9100);
        if (isReachable) {
          console.log(`✅ Found printer at ${ip}:9100`);

          const printer = {
            ip: ip,
            localIp: ip,
            port: 9100,
            name: ip === "192.168.1.202" ? "Epson Printer" : `Printer at ${ip}`,
            openPorts: [9100],
            isLikelyPrinter: true,
            confidence: ip === "192.168.1.202" ? 95 : 85,
            timestamp: new Date().toISOString(),
            serviceType: "socket-discovery",
            hostname: ip,
            discoveryMethod: "socket",
          };

          // Test additional ports if extended mode is enabled
          if (includeExtendedPorts) {
            const extendedPorts = [9101, 515, 631];
            for (const port of extendedPorts) {
              try {
                const isOpen = await testSocketConnection(ip, port);
                if (isOpen) {
                  printer.openPorts.push(port);
                  console.log(`✅ Additional port found: ${ip}:${port}`);
                }
              } catch (error) {
                // Continue to next port
              }
            }
          }

          console.log(`🖨️ Adding printer to discovered list:`, printer);
          discoveredPrinters.push(printer);
        } else {
          console.log(`❌ No response from ${ip}:9100`);
        }
      } catch (error) {
        console.log(`❌ Error testing ${ip}:`, error.message);
      }

      completedTests++;
      console.log(
        `📊 Progress: ${completedTests}/${totalTests}, Found: ${discoveredPrinters.length}`,
      );

      // Update progress
      if (onProgress) {
        console.log(
          `📡 Calling onProgress(${completedTests}, ${totalTests}, ${discoveredPrinters.length})`,
        );
        onProgress(completedTests, totalTests, discoveredPrinters.length);
      }

      // Small delay between tests to prevent overwhelming the network stack
      if (i < printerIPs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `🏁 Discovery loop completed. Found ${discoveredPrinters.length} printers`,
    );

    timings.discovery = Date.now() - discoveryStart;
    timings.total = Date.now() - startTime;

    // Log discovery results
    console.log("\n" + "=".repeat(50));
    console.log("📊 SOCKET DISCOVERY RESULTS SUMMARY");
    console.log("=".repeat(50));
    console.log(
      `⏱️  Total time: ${timings.total}ms (${(timings.total / 1000).toFixed(1)}s)`,
    );
    console.log(`🔍 Discovery time: ${timings.discovery}ms`);
    console.log(`🔌 IPs tested: ${totalTests}`);
    console.log(`🖨️  Printers found: ${discoveredPrinters.length}`);

    if (discoveredPrinters.length > 0) {
      console.log("\n🖨️  Discovered Printers:");
      discoveredPrinters.forEach((printer, index) => {
        console.log(
          `  ${index + 1}. ${printer.name} (${printer.ip}:${printer.port})`,
        );
        console.log(`     Ports: ${printer.openPorts.join(", ")}`);
        console.log(`     Confidence: ${printer.confidence}%`);
      });
    } else {
      console.log("\n⚠️  No printers found on popular IP addresses.");
      console.log("💡 This could mean:");
      console.log("   - Your printer uses a different IP address");
      console.log("   - Printer is not on the same network");
      console.log("   - Printer is turned off or in sleep mode");
      console.log("   - Use 'Add Manually' to enter specific IP address");
    }

    console.log("=".repeat(50) + "\n");

    const result = {
      success: true,
      printers: discoveredPrinters,
      message:
        discoveredPrinters.length > 0
          ? `Found ${discoveredPrinters.length} printer(s) via socket discovery`
          : "No printers found on popular IPs. Use manual entry instead.",
      timings: timings,
    };

    console.log(`🚀 Returning discovery result:`, result);
    return result;
  } catch (error) {
    timings.total = Date.now() - startTime;
    console.log(`❌ Discovery error after ${timings.total}ms:`, error.message);

    return {
      success: false,
      printers: [],
      message: `Discovery failed: ${error.message || "Unknown error"}`,
      timings: timings,
    };
  }
}
