/**
 * Load a remote image URL and convert it to ESC/POS GS v 0 raster bytes.
 * Runs in the browser / Capacitor WebView (uses canvas).
 */

const ESC_ALIGN_CENTER = [0x1b, 0x61, 0x01];
const STAR_ALIGN_CENTER = [0x1b, 0x1d, 0x61, 0x01];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Convert RGBA ImageData to monochrome GS v 0 raster command bytes.
 * Bit 1 = print (black). Width padded to a multiple of 8.
 *
 * @param {ImageData} imageData
 * @param {number} [threshold=160] - luminance below this becomes black
 * @returns {number[]}
 */
export function imageDataToGsV0Raster(imageData, threshold = 160) {
  const { width, height, data } = imageData;
  const bytesPerRow = Math.ceil(width / 8);
  const rows = [];

  for (let y = 0; y < height; y++) {
    const row = new Array(bytesPerRow).fill(0);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      // Transparent → white (no print)
      if (a < 128) continue;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance < threshold) {
        row[Math.floor(x / 8)] |= 0x80 >> x % 8;
      }
    }
    rows.push(...row);
  }

  return [
    0x1d,
    0x76,
    0x30,
    0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
    ...rows,
  ];
}

/**
 * Fetch image URL, draw to canvas scaled to maxWidthDots, return GS v 0 bytes.
 *
 * @param {string} url
 * @param {{ maxWidthDots?: number, threshold?: number }} [options]
 * @returns {Promise<number[]>}
 */
export async function imageUrlToEscPosRaster(url, options = {}) {
  const maxWidthDots = options.maxWidthDots ?? 256;
  const threshold = options.threshold ?? 160;

  if (!url || typeof url !== "string") {
    throw new Error("imageUrlToEscPosRaster: url is required");
  }
  if (typeof document === "undefined") {
    throw new Error("imageUrlToEscPosRaster: requires a browser environment");
  }

  const img = await loadImage(url);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) {
    throw new Error("imageUrlToEscPosRaster: image has no dimensions");
  }

  let width = Math.min(maxWidthDots, srcW);
  width = Math.max(8, Math.floor(width / 8) * 8);
  const height = Math.max(1, Math.round((srcH * width) / srcW));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("imageUrlToEscPosRaster: canvas 2d context unavailable");
  }

  // White background so JPEG logos without alpha don't threshold oddly
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return imageDataToGsV0Raster(ctx.getImageData(0, 0, width, height), threshold);
}

/**
 * Prepend a centered logo raster after ESC @ in an existing ESC/POS base64 payload.
 *
 * @param {string} printDataBase64
 * @param {number[]} logoRasterBytes - GS v 0 payload (no alignment)
 * @param {{ starAlign?: boolean }} [options]
 * @returns {string} base64
 */
export function prependCenteredLogoToEscPosBase64(
  printDataBase64,
  logoRasterBytes,
  options = {},
) {
  const orderBytes = Uint8Array.from(atob(printDataBase64), (c) =>
    c.charCodeAt(0),
  );

  let offset = 0;
  if (orderBytes.length >= 2 && orderBytes[0] === 0x1b && orderBytes[1] === 0x40) {
    offset = 2;
  }

  const align = options.starAlign ? STAR_ALIGN_CENTER : ESC_ALIGN_CENTER;
  const prefix = [0x1b, 0x40, ...align, ...logoRasterBytes, 0x0a, 0x0a];
  const combined = new Uint8Array(
    prefix.length + (orderBytes.length - offset),
  );
  combined.set(prefix, 0);
  combined.set(orderBytes.subarray(offset), prefix.length);

  let binary = "";
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}
