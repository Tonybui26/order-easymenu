import { isStarPrntPrinter } from "@/lib/constants/printerLanguages";
import { formatFontTestEscPos } from "./formatFontTestEscPos";
import { formatFontTestStarPrnt } from "./formatFontTestStarPrnt";

export function formatFontTestForPrinter(printer) {
  const name = printer?.name || "";
  if (isStarPrntPrinter(printer)) {
    return formatFontTestStarPrnt(name);
  }
  return formatFontTestEscPos(name);
}
