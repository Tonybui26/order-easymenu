import { isStarPrntPrinter } from "@/lib/constants/printerLanguages";
import { createEscPosCommands, formatOrderForPrintingWithESC_POS } from "@/lib/helper/printerUtils.js";
import {
  createStarPrntCommands,
  formatOrderForPrintingWithStarPrnt,
} from "@/lib/printers/starprnt/formatOrderForPrintingWithStarPrnt.js";

/**
 * Pick receipt formatter for a printer profile. Defaults to ESC/POS (Epson, etc.).
 */
export function formatOrderForReceiptPrinter(
  order,
  orderId,
  menuLink,
  printer,
  printOptions = {},
) {
  if (isStarPrntPrinter(printer)) {
    return formatOrderForPrintingWithStarPrnt(
      order,
      orderId,
      menuLink,
      printOptions,
    );
  }
  return formatOrderForPrintingWithESC_POS(
    order,
    orderId,
    menuLink,
    printOptions,
  );
}

/**
 * Pick simple test-message formatter for a printer profile.
 */
export function createReceiptTestCommands(message, printer) {
  if (isStarPrntPrinter(printer)) {
    return createStarPrntCommands(message);
  }
  return createEscPosCommands(message);
}
