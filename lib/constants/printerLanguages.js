export const PRINTER_COMMAND_LANGUAGES = {
  ESCPOS: "escpos",
  STARPRNT: "starprnt",
  TSPL: "tspl",
};

export const DEFAULT_PRINTER_COMMAND_LANGUAGE =
  PRINTER_COMMAND_LANGUAGES.ESCPOS;

export function isTsplPrinter(printer) {
  return printer?.commandLanguage === PRINTER_COMMAND_LANGUAGES.TSPL;
}

export function isStarPrntPrinter(printer) {
  return printer?.commandLanguage === PRINTER_COMMAND_LANGUAGES.STARPRNT;
}

export function isEscPosPrinter(printer) {
  const lang = printer?.commandLanguage || DEFAULT_PRINTER_COMMAND_LANGUAGE;
  return lang === PRINTER_COMMAND_LANGUAGES.ESCPOS;
}
