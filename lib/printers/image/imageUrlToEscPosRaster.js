/**
 * Load a remote image URL and convert it to ESC/POS GS v 0 raster bytes.
 * Runs in the browser / Capacitor WebView (uses canvas).
 *
 * Uses same-origin /api/proxy-image so S3/CDN CORS cannot block getImageData.
 */

/** Max logo width on Print Test (dots). Height scales to keep aspect ratio.
 *  Tips: 160 = small, 256 = medium (default), 384 ≈ full 58mm, 512–576 ≈ 80mm. */
export const PRINT_TEST_LOGO_MAX_WIDTH_DOTS = 384;

const ESC_ALIGN_CENTER = [0x1b, 0x61, 0x01];

function loadImageFromObjectUrl(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Failed to decode proxied store logo image"));
    img.src = objectUrl;
  });
}

/**
 * Convert RGBA ImageData to monochrome GS v 0 raster command bytes.
 * Bit 1 = print (black). Width padded to a multiple of 8.
 *
 * @param {ImageData} imageData
 * @param {number} [threshold=160] - luminance below this becomes black
 * @returns {{ bytes: number[], blackPixels: number, width: number, height: number }}
 */
export function imageDataToGsV0Raster(imageData, threshold = 160) {
  const { width, height, data } = imageData;
  const bytesPerRow = Math.ceil(width / 8);
  const rows = [];
  let blackPixels = 0;

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
        blackPixels += 1;
      }
    }
    rows.push(...row);
  }

  return {
    bytes: [
      0x1d,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
      ...rows,
    ],
    blackPixels,
    width,
    height,
  };
}

async function fetchLogoBlob(url) {
  if (typeof window === "undefined") {
    throw new Error("imageUrlToEscPosRaster: requires a browser environment");
  }

  const proxyUrl = `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Logo proxy failed (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  return res.blob();
}

/**
 * Fetch image URL (via same-origin proxy), draw to canvas, return GS v 0 bytes.
 *
 * @param {string} url
 * @param {{ maxWidthDots?: number, threshold?: number }} [options]
 * @returns {Promise<{ bytes: number[], blackPixels: number, width: number, height: number }>}
 */
export async function imageUrlToEscPosRaster(url, options = {}) {
  const maxWidthDots = options.maxWidthDots ?? PRINT_TEST_LOGO_MAX_WIDTH_DOTS;
  const threshold = options.threshold ?? 160;

  if (!url || typeof url !== "string") {
    throw new Error("imageUrlToEscPosRaster: url is required");
  }

  const blob = await fetchLogoBlob(url);
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = await loadImageFromObjectUrl(objectUrl);
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

    let raster = imageDataToGsV0Raster(
      ctx.getImageData(0, 0, width, height),
      threshold,
    );

    // Light/near-white logos: invert so something actually prints
    if (raster.blackPixels === 0) {
      raster = imageDataToGsV0Raster(
        ctx.getImageData(0, 0, width, height),
        250,
      );
    }

    if (raster.blackPixels === 0) {
      throw new Error(
        "Logo converted to an empty (all-white) raster — check logo contrast",
      );
    }

    return raster;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Prepend a centered logo raster after ESC @ in an existing ESC/POS base64 payload.
 *
 * @param {string} printDataBase64
 * @param {number[]} logoRasterBytes - GS v 0 payload (no alignment)
 * @returns {string} base64
 */
export function prependCenteredLogoToEscPosBase64(
  printDataBase64,
  logoRasterBytes,
) {
  const orderBytes = Uint8Array.from(atob(printDataBase64), (c) =>
    c.charCodeAt(0),
  );

  let offset = 0;
  if (
    orderBytes.length >= 2 &&
    orderBytes[0] === 0x1b &&
    orderBytes[1] === 0x40
  ) {
    offset = 2;
  }

  // GS v 0 is ESC/POS — always use ESC a 1 for centering the logo band
  const prefix = [
    0x1b,
    0x40,
    ...ESC_ALIGN_CENTER,
    ...logoRasterBytes,
    0x0a,
    0x0a,
  ];
  const combined = new Uint8Array(prefix.length + (orderBytes.length - offset));
  combined.set(prefix, 0);
  combined.set(orderBytes.subarray(offset), prefix.length);

  let binary = "";
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}
