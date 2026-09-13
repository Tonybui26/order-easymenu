/**
 * Printers list snapshot + in-memory session cache.
 *
 * Read order when gate on (cache-first during a long unlock):
 *   1) memory  2) SQLite  3) network → then save memory + SQLite
 *
 * Force network (skip memory/SQLite) when:
 *   - catalog sync after network menu (sign-in / Reload apply / PIN unlock)
 *   - printer CRUD on Printer Management
 *
 * Soft-fails on SQLite errors — never breaks printing.
 */
import { openLocalDb, isLocalDbSupported } from "@/lib/localDb/sqliteClient";
import { isLocalCatalogCacheEnabled } from "@/lib/localDb/localCacheGate";

/** @type {{ printers: Array } | null} */
let memoryPrinters = null;

function firstRow(result) {
  const row = result?.values?.[0];
  return row ?? null;
}

function rowField(row, key) {
  if (row == null) return null;
  if (typeof row === "object" && !Array.isArray(row)) return row[key] ?? null;
  return null;
}

export function getMemoryPrinters() {
  return memoryPrinters;
}

/**
 * @param {{ printers?: Array } | null} data
 */
export function setMemoryPrinters(data) {
  memoryPrinters =
    data && typeof data === "object"
      ? { printers: Array.isArray(data.printers) ? data.printers : [] }
      : null;
}

export function clearMemoryPrinters() {
  memoryPrinters = null;
}

/**
 * @param {{ printers?: Array }} data — shape from GET /api/printers
 * @returns {Promise<boolean>}
 */
export async function savePrintersSnapshot(data) {
  if (!isLocalCatalogCacheEnabled() || !isLocalDbSupported()) return false;
  if (!data || typeof data !== "object") return false;

  try {
    const db = await openLocalDb();
    const normalized = {
      printers: Array.isArray(data.printers) ? data.printers : [],
    };
    const payload = JSON.stringify(normalized);
    const updatedAt = Date.now();
    await db.run(
      "INSERT OR REPLACE INTO printers_snapshot (id, payload, updated_at) VALUES (1, ?, ?)",
      [payload, updatedAt],
    );
    setMemoryPrinters(normalized);
    return true;
  } catch (error) {
    console.error("savePrintersSnapshot:", error);
    return false;
  }
}

/**
 * @returns {Promise<{ payload: { printers: Array }, updatedAt: number } | null>}
 */
export async function readPrintersSnapshot() {
  if (!isLocalDbSupported()) return null;

  try {
    const db = await openLocalDb();
    const result = await db.query(
      "SELECT payload, updated_at FROM printers_snapshot WHERE id = 1",
    );
    const row = firstRow(result);
    if (!row) return null;

    const rawPayload = rowField(row, "payload");
    const updatedAt = Number(rowField(row, "updated_at") || 0);
    if (!rawPayload || typeof rawPayload !== "string") return null;

    const parsed = JSON.parse(rawPayload);
    return {
      payload: {
        printers: Array.isArray(parsed?.printers) ? parsed.printers : [],
      },
      updatedAt,
    };
  } catch (error) {
    console.error("readPrintersSnapshot:", error);
    return null;
  }
}
