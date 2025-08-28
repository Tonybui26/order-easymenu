// ESC/POS Printer Service
const axios = require("axios");
const net = require("net");

// const domain = "https://goeasy.menu";
const domain = "http://localhost:3001";
const API_URL = `${domain}/api/printers/getPrintJobs`;
let PRINTER_IP = "192.168.1.202"; // default printer ip - This will be changed in the polling job
let PRINTER_PORT = 9100;
const STORE_ID = "67a44ed5dceeb2b3b7c63de4";

async function pollPrintJobs() {
  try {
    const response = await axios.get(API_URL, {
      params: { storeId: STORE_ID },
    });
    if (response.data.printJobs.length === 0) {
      console.log(response.data.message);
      return;
    }
    const jobs = response.data.printJobs;

    for (const job of jobs) {
      if (job.status === "pending") {
        // Format the order for printing with ESC/POS
        const printDocument = formatOrderForPrintingWithESC_POS(
          job.orderData,
          job.orderId,
        );

        let isAtLeastOnePrinterSuccess = false;

        // Loop through the printers
        for (const printer of job.printers) {
          if (printer.printerId.length > 0) {
            PRINTER_IP = printer.localIp;
            PRINTER_PORT = printer.port;
            const success = await sendToPrinter_ESC_POS(printDocument);
            if (success) {
              isAtLeastOnePrinterSuccess = true;
              console.log(`Printed job ${job._id}`);
            } else {
              console.error(`Failed to print job ${job._id}`);
            }
          }
        }

        // Update job status to printed if at least one printer is success or failed if all printers failed
        if (isAtLeastOnePrinterSuccess) {
          console.log("success at least one printer");
          await axios.post(`${domain}/api/printers/updatePrintJob`, {
            printJobId: job._id,
            status: "printed",
          });
        } else {
          console.log("failed all printers");
          await axios.post(`${domain}/api/printers/updatePrintJob`, {
            printJobId: job._id,
            status: "failed",
          });
        }
      }
    }
  } catch (err) {
    console.error("Polling Error:", err.response?.data?.error || err.message);
  }
}

// Poll every 5 seconds
setInterval(pollPrintJobs, 5000);
pollPrintJobs();

function formatOrderForPrintingWithESC_POS(order, orderId) {
  let commands = [];

  // Initialize printer
  commands.push(Buffer.from([0x1b, 0x40])); // ESC @ - Initialize printer

  // Center alignment and double width/height for header
  commands.push(Buffer.from([0x1b, 0x61, 0x01])); // ESC a 1 - Center alignment
  commands.push(Buffer.from([0x1b, 0x21, 0x30])); // ESC ! 48 - Double width and height

  // Store header
  commands.push(Buffer.from("\n", "utf8"));
  commands.push(Buffer.from(`#${orderId}\n`, "utf8"));

  // Order info with bold
  commands.push(Buffer.from([0x1b, 0x45, 0x01])); // ESC E 1 - Bold on
  commands.push(Buffer.from(`*** ${order.table} ***\n\n`, "utf8"));
  commands.push(Buffer.from([0x1b, 0x45, 0x00])); // ESC E 0 - Bold off

  // Reset to normal size
  commands.push(Buffer.from([0x1b, 0x21, 0x00])); // ESC ! 0 - Normal size

  if (order.table.toLowerCase() !== "takeaway") {
    commands.push(
      Buffer.from(`${new Date(order.createdAt).toLocaleString()}\n`, "utf8"),
    );
    commands.push(
      Buffer.from("\n------------------------------------------\n\n", "utf8"),
    );
  } else {
    // Left alignment for takeaway orders
    commands.push(Buffer.from([0x1b, 0x61, 0x00])); // ESC a 0 - Left alignment
    commands.push(
      Buffer.from(
        `   Online Order (${new Date(order.createdAt).toLocaleString()})\n`,
        "utf8",
      ),
    );
    commands.push(Buffer.from(`   Payment: ${order.paymentStatus}\n`, "utf8"));
    commands.push(Buffer.from(`   Pickup: ${order.pickupTime}\n`, "utf8"));
    commands.push(
      Buffer.from(
        `   for ${order.customerName} | ${order.customerPhone}\n`,
        "utf8",
      ),
    );
    commands.push(Buffer.from(`   ${order.customerEmail}\n`, "utf8"));
    commands.push(Buffer.from([0x1b, 0x61, 0x01])); // ESC a 1 - Center alignment
    commands.push(
      Buffer.from("\n------------------------------------------\n\n", "utf8"),
    );
  }

  // Items
  order.items.forEach((item) => {
    // Bold for item name
    commands.push(Buffer.from([0x1b, 0x45, 0x01])); // ESC E 1 - Bold on
    commands.push(Buffer.from([0x1b, 0x61, 0x00])); // ESC a 0 - Left alignment
    commands.push(Buffer.from(`   ${item.quantity} x ${item.name}\n`, "utf8"));
    commands.push(Buffer.from([0x1b, 0x45, 0x00])); // ESC E 0 - Bold off

    // Variants
    if (item.selectedVariants) {
      item.selectedVariants.forEach((variant) => {
        commands.push(
          Buffer.from(
            `       ${variant.groupName}: ${variant.optionName}\n`,
            "utf8",
          ),
        );
      });
    }

    // Modifiers
    if (item.selectedModifiers) {
      item.selectedModifiers.forEach((modifier) => {
        commands.push(
          Buffer.from(
            `       ${modifier.groupName}: ${modifier.optionName}\n`,
            "utf8",
          ),
        );
      });
    }

    commands.push(Buffer.from("\n", "utf8"));
  });

  // Footer
  commands.push(Buffer.from([0x1b, 0x61, 0x01])); // ESC a 1 - Center alignment
  commands.push(
    Buffer.from("\n------------------------------------------\n", "utf8"),
  );
  commands.push(Buffer.from([0x1b, 0x45, 0x01])); // ESC E 1 - Bold on
  commands.push(Buffer.from("\npowered by goeasy.menu\n", "utf8"));
  commands.push(Buffer.from([0x1b, 0x45, 0x00])); // ESC E 0 - Bold off

  // Feed paper and cut
  commands.push(Buffer.from([0x1b, 0x64, 0x03])); // ESC d 3 - Feed 3 lines
  commands.push(Buffer.from([0x1d, 0x56, 0x41, 0x03])); // GS V A 3 - Cut paper

  return Buffer.concat(commands);
}

// Send print job to printer via TCP
async function sendToPrinter_ESC_POS(printDocument) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let success = false;

    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      console.log(`Connected to printer ${PRINTER_IP}:${PRINTER_PORT}`);
      client.write(printDocument);
      client.end();
    });

    client.on("data", (data) => {
      console.log("Printer response:", data.toString());
    });

    client.on("error", (err) => {
      console.error("Printer Error:", err.message);
      success = false;
      resolve(false);
    });

    client.on("close", () => {
      console.log("Connection closed");
      success = true;
      resolve(true);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!success) {
        console.error("Printer timeout");
        client.destroy();
        resolve(false);
      }
    }, 10000);
  });
}

console.log("ESC/POS Printer server running...");
