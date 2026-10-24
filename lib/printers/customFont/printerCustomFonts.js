/**
 * Per-printer custom fonts. Off by default — ESC/POS then uses the printer's
 * built-in font, same as before. Ids must match easymenu `app/api/printers/route.js`.
 */

export const PRINTER_CUSTOM_FONTS = [
  {
    id: "noto-sans-khmer",
    label: "Noto Sans Khmer",
    family: "Noto Sans Khmer",
    fileUrl: "/fonts/noto-sans-khmer/NotoSansKhmer-Variable.ttf",
  },
];

const loadedFontIds = new Set();

export function getPrinterCustomFontLabel(printer) {
  if (!printer?.useCustomFont) return "";
  return (
    PRINTER_CUSTOM_FONTS.find((font) => font.id === printer.customFontId)
      ?.label || ""
  );
}

/**
 * Font to use for this printer, or null when custom font is off / not ESC/POS.
 * Throws when the flag is on but the id is not one we ship.
 */
export function resolveEscPosCustomFont(printer) {
  if (!printer?.useCustomFont) return null;
  const language = printer.commandLanguage || "escpos";
  if (language !== "escpos") return null;

  const font = PRINTER_CUSTOM_FONTS.find(
    (item) => item.id === printer.customFontId,
  );
  if (!font) {
    throw new Error("This printer's custom font is not available");
  }
  return font;
}

/**
 * Load the printer font into the document so canvas can draw it.
 * No-op when this printer does not use a custom font.
 */
export async function ensurePrinterCustomFontReady(printer) {
  const font = resolveEscPosCustomFont(printer);
  if (!font) return null;
  if (typeof document === "undefined") {
    throw new Error("Custom font printing runs in the Order Manager app");
  }

  if (!loadedFontIds.has(font.id)) {
    const face = new FontFace(font.family, `url(${font.fileUrl})`, {
      weight: "100 900",
      stretch: "62.5% 100%",
      style: "normal",
    });
    document.fonts.add(await face.load());
    loadedFontIds.add(font.id);
  }

  await document.fonts.load(`400 24px "${font.family}"`);
  await document.fonts.load(`700 48px "${font.family}"`);

  const probe = document.createElement("span");
  probe.textContent = "ក";
  probe.style.fontFamily = `"${font.family}"`;
  probe.style.fontSize = "24px";
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  document.body.appendChild(probe);
  probe.offsetWidth;
  probe.remove();

  return font;
}
