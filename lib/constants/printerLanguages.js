export const PRINTER_COMMAND_LANGUAGES = {
  ESCPOS: "escpos",
  TSPL: "tspl",
};

export const DEFAULT_PRINTER_COMMAND_LANGUAGE =
  PRINTER_COMMAND_LANGUAGES.ESCPOS;

export function isTsplPrinter(printer) {
  return printer?.commandLanguage === PRINTER_COMMAND_LANGUAGES.TSPL;
}
