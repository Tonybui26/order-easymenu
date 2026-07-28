import { isStarPrntPrinter } from "@/lib/constants/printerLanguages";
import { formatCashDrawerKickEscPos } from "./formatCashDrawerKickEscPos";
import { formatCashDrawerKickStarPrnt } from "./formatCashDrawerKickStarPrnt";

/**
 * Pick cash drawer kick formatter from printer commandLanguage.
 * @param {Object} printer
 */
export function formatCashDrawerKickForPrinter(printer) {
  if (isStarPrntPrinter(printer)) {
    return formatCashDrawerKickStarPrnt();
  }
  return formatCashDrawerKickEscPos();
}
