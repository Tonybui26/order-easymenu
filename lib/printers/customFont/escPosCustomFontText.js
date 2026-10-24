/**
 * ESC/POS text helper.
 * ASCII (and Vietnamese already folded to ASCII) stays as printer text bytes.
 * Any other character is drawn with the printer's custom font and sent as a
 * GS v 0 raster, so the built-in font is never asked to print Khmer.
 */

import { imageDataToGsV0Raster } from "../image/imageUrlToEscPosRaster.js";

const BASE_FONT_PX = 24;
const PAPER_WIDTH_DOTS = 576;

let measureCanvas = null;

export function createEscPosTextStyle() {
  return {
    widthMul: 1,
    heightMul: 1,
    bold: false,
    escBangBold: false,
    escEmphasized: false,
    reverse: false,
  };
}

function syncBold(style) {
  style.bold = style.escBangBold || style.escEmphasized;
}

/** Track size / bold / reverse from the ESC/POS bytes we already send. */
export function noteEscPosStyle(style, bytes) {
  const list = Array.isArray(bytes) ? bytes : [bytes];
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const n1 = list[i + 1];
    const n2 = list[i + 2];

    if (b === 0x1b && n1 === 0x40) {
      style.widthMul = 1;
      style.heightMul = 1;
      style.escBangBold = false;
      style.escEmphasized = false;
      style.reverse = false;
      syncBold(style);
      i += 1;
      continue;
    }
    if (b === 0x1b && n1 === 0x21 && n2 != null) {
      style.widthMul = n2 & 0x20 ? 2 : 1;
      style.heightMul = n2 & 0x10 ? 2 : 1;
      style.escBangBold = (n2 & 0x08) !== 0;
      syncBold(style);
      i += 2;
      continue;
    }
    if (b === 0x1b && n1 === 0x45 && n2 != null) {
      style.escEmphasized = n2 === 0x01;
      syncBold(style);
      i += 2;
      continue;
    }
    if (b === 0x1d && n1 === 0x42 && n2 != null) {
      style.reverse = n2 === 0x01;
      i += 2;
    }
  }
}

export function textNeedsCustomFont(text) {
  const value = String(text ?? "");
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 0x7f) return true;
  }
  return false;
}

function fontCss(style, family) {
  const weight = style?.bold ? 700 : 400;
  const fontSize = BASE_FONT_PX * (style?.heightMul || 1);
  return `${weight} ${fontSize}px "${family}"`;
}

function widthScaleOf(style) {
  return (style?.widthMul || 1) / (style?.heightMul || 1);
}

function measureContext(style, font) {
  if (typeof document === "undefined") {
    throw new Error("Custom font printing runs in the Order Manager app");
  }
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not measure custom font text");
  ctx.font = fontCss(style, font.family);
  return ctx;
}

export function measureEscPosTextWidth(text, style, font) {
  const ctx = measureContext(style, font);
  return ctx.measureText(text).width * widthScaleOf(style);
}

export function wrapEscPosCustomFontText(text, maxChars, style, font) {
  const maxDots = Math.min(
    PAPER_WIDTH_DOTS - 16,
    maxChars * 12 * (style?.widthMul || 1),
  );
  const value = String(text ?? "");
  if (!value || measureEscPosTextWidth(value, style, font) <= maxDots) {
    return [value];
  }

  const words = value.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (measureEscPosTextWidth(test, style, font) <= maxDots) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [value];
}

function renderEscPosTextLine(text, style, font) {
  const fontSize = BASE_FONT_PX * (style.heightMul || 1);
  const widthScale = widthScaleOf(style);
  const measureCtx = measureContext(style, font);
  const metrics = measureCtx.measureText(text);
  const naturalWidth = Math.max(1, metrics.width * widthScale);
  const ascent = Math.ceil(
    (metrics.actualBoundingBoxAscent || fontSize * 0.9) + fontSize * 0.08,
  );
  const descent = Math.ceil(
    (metrics.actualBoundingBoxDescent || fontSize * 0.35) + fontSize * 0.16,
  );
  const padX = 2;
  const maxInner = PAPER_WIDTH_DOTS - padX * 2;
  const fit = naturalWidth > maxInner ? maxInner / naturalWidth : 1;
  const width = Math.max(
    8,
    Math.ceil((naturalWidth * fit + padX * 2) / 8) * 8,
  );
  const height = Math.max(8, Math.ceil((ascent + descent) * fit));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const draw = canvas.getContext("2d");
  if (!draw) throw new Error("Could not draw custom font text");

  const reversed = Boolean(style.reverse);
  draw.fillStyle = reversed ? "#000000" : "#ffffff";
  draw.fillRect(0, 0, width, height);
  draw.font = fontCss(style, font.family);
  draw.fillStyle = reversed ? "#ffffff" : "#000000";
  draw.textBaseline = "alphabetic";
  draw.save();
  draw.translate(padX, Math.ceil(ascent * fit));
  draw.scale(fit * widthScale, fit);
  draw.fillText(text, 0, 0);
  draw.restore();

  const raster = imageDataToGsV0Raster(
    draw.getImageData(0, 0, width, height),
    reversed ? 96 : 200,
  );
  return raster.bytes;
}

function assertCustomFontLoaded(font) {
  if (typeof document === "undefined" || !document.fonts?.check) {
    throw new Error("Custom font printing runs in the Order Manager app");
  }
  if (!document.fonts.check(`16px "${font.family}"`)) {
    throw new Error(`${font.label} is not loaded`);
  }
}

/**
 * Append text. Without a font, or when the string is ASCII, this is UTF-8
 * text bytes — the same payload the docket formatter sent before.
 */
export function appendEscPosText(commands, text, style, font) {
  if (!font || !textNeedsCustomFont(text)) {
    commands.push(...new TextEncoder().encode(text));
    return;
  }

  assertCustomFontLoaded(font);

  const parts = String(text).split("\n");
  for (let i = 0; i < parts.length; i++) {
    const line = parts[i];
    const isLast = i === parts.length - 1;
    const drawLine = Boolean(line) && textNeedsCustomFont(line);

    if (drawLine) {
      if (style.reverse) commands.push(0x1d, 0x42, 0x00);
      commands.push(...renderEscPosTextLine(line, style, font));
      if (style.reverse) commands.push(0x1d, 0x42, 0x01);
    } else if (line) {
      commands.push(...new TextEncoder().encode(line));
    }

    if (!isLast && !drawLine) commands.push(0x0a);
  }
}

export function commandsToBase64(commands) {
  const uint8Array = new Uint8Array(commands);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length)),
    );
  }
  return btoa(binary);
}
