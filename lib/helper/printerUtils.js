import { TcpSocket, DataEncoding } from "capacitor-tcp-socket";

const PRINTER_IP = "192.168.1.202"; // Your hardcoded printer IP
const PRINTER_PORT = 9100;

/**
 * Creates ESC/POS commands for printing text
 * @param {string} text - The text to print
 * @returns {string} - Base64 encoded ESC/POS commands
 */
function createEscPosCommands(text) {
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

/**
 * Sends a test print to the configured printer
 * @param {string} message - The message to print (default: "Hello World")
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printTestMessage(
  message = "Hello World from Mobile App!",
) {
  let clientId;

  try {
    console.log(`Connecting to printer at ${PRINTER_IP}:${PRINTER_PORT}`);

    // Connect to printer
    const connectResult = await TcpSocket.connect({
      ipAddress: PRINTER_IP,
      port: PRINTER_PORT,
    });

    clientId = connectResult.client;
    console.log(`Connected with client ID: ${clientId}`);

    // Create ESC/POS commands
    const printData = createEscPosCommands(message);

    // Send data to printer
    await TcpSocket.send({
      client: clientId,
      data: printData,
      encoding: DataEncoding.BASE64,
    });

    console.log("Print data sent successfully");

    // Disconnect from printer
    await TcpSocket.disconnect({
      client: clientId,
    });

    return {
      success: true,
      message: "Test print sent successfully!",
    };
  } catch (error) {
    console.error("Print error:", error);

    // Try to disconnect if we have a client ID
    if (clientId) {
      try {
        await TcpSocket.disconnect({ client: clientId });
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

/**
 * Prints a full order receipt (similar to your Node.js version)
 * @param {Object} order - The order data
 * @param {string} orderId - The order ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printOrder(order, orderId) {
  let clientId;

  try {
    // Connect to printer
    const connectResult = await TcpSocket.connect({
      ipAddress: PRINTER_IP,
      port: PRINTER_PORT,
    });

    clientId = connectResult.client;

    // Create order text
    let orderText = `#${orderId}\n`;
    orderText += `*** ${order.table} ***\n\n`;

    if (order.table.toLowerCase() !== "takeaway") {
      orderText += `${new Date(order.createdAt).toLocaleString()}\n`;
      orderText += `------------------------------------------\n\n`;
    } else {
      orderText += `   Online Order (${new Date(order.createdAt).toLocaleString()})\n`;
      orderText += `   Payment: ${order.paymentStatus}\n`;
      orderText += `   Pickup: ${order.pickupTime}\n`;
      orderText += `   for ${order.customerName} | ${order.customerPhone}\n`;
      orderText += `   ${order.customerEmail}\n`;
      orderText += `\n------------------------------------------\n\n`;
    }

    // Add items
    order.items.forEach((item) => {
      orderText += `   ${item.quantity} x ${item.name}\n`;

      // Add variants
      if (item.selectedVariants) {
        item.selectedVariants.forEach((variant) => {
          orderText += `       ${variant.groupName}: ${variant.optionName}\n`;
        });
      }

      // Add modifiers
      if (item.selectedModifiers) {
        item.selectedModifiers.forEach((modifier) => {
          orderText += `       ${modifier.groupName}: ${modifier.optionName}\n`;
        });
      }

      orderText += `\n`;
    });

    // Create ESC/POS commands
    const printData = createEscPosCommands(orderText);

    // Send data to printer
    await TcpSocket.send({
      client: clientId,
      data: printData,
      encoding: DataEncoding.BASE64,
    });

    // Disconnect from printer
    await TcpSocket.disconnect({
      client: clientId,
    });

    return {
      success: true,
      message: "Order printed successfully!",
    };
  } catch (error) {
    console.error("Print order error:", error);

    // Try to disconnect if we have a client ID
    if (clientId) {
      try {
        await TcpSocket.disconnect({ client: clientId });
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
