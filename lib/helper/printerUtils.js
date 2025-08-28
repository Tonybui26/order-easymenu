import { TcpSocket, DataEncoding } from "capacitor-tcp-socket";

const PRINTER_IP = "192.168.0.71"; // Your hardcoded printer IP
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

    // Connect to printer
    const connectResult = await TcpSocket.connect({
      ipAddress: printerIp,
      port: printerPort,
    });

    clientId = connectResult.client;
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
    await TcpSocket.send({
      client: clientId,
      data: printData,
      encoding: DataEncoding.BASE64,
    });

    console.log("Test print data sent successfully");

    // Disconnect from printer
    await TcpSocket.disconnect({
      client: clientId,
    });

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
        const connectResult = await TcpSocket.connect({
          ipAddress: printer.localIp,
          port: printer.port,
        });

        clientId = connectResult.client;

        // Format order using ESC/POS
        const printDocument = formatOrderForPrintingWithESC_POS(order, orderId);

        // Send data to printer
        await TcpSocket.send({
          client: clientId,
          data: printDocument,
          encoding: DataEncoding.BASE64,
        });

        // Disconnect from printer
        await TcpSocket.disconnect({
          client: clientId,
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
            await TcpSocket.disconnect({ client: clientId });
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
      message: `Print failed: Could not print to any of the ${totalPrinters} printer(s)`,
    };
  }
}

function formatOrderForPrintingWithESC_POS(order, orderId) {
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
    // Bold for item name
    addBytes([0x1b, 0x45, 0x01]); // ESC E 1 - Bold on
    addBytes([0x1b, 0x61, 0x00]); // ESC a 0 - Left alignment
    addText(`   ${item.quantity} x ${item.name}\n`);
    addBytes([0x1b, 0x45, 0x00]); // ESC E 0 - Bold off

    // Variants
    if (item.selectedVariants) {
      item.selectedVariants.forEach((variant) => {
        addText(`       ${variant.groupName}: ${variant.optionName}\n`);
      });
    }

    // Modifiers
    if (item.selectedModifiers) {
      item.selectedModifiers.forEach((modifier) => {
        addText(`       ${modifier.groupName}: ${modifier.optionName}\n`);
      });
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
