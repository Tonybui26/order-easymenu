/**
 * Menu catalog snapshot in SQLite (single row, id = 1).
 *
 * WRITE when: first authenticated load / Reload (SSR menu applied), soft
 * refreshMenuData, or PIN unlock sync — always after a successful network menu.
 * READ when: testing panel (and later cold-start hydrate). Printers use a
 * separate snapshot; Live Orders polling never reads this.
 *
 * Soft-fails when not native or SQLite errors — never breaks POS.
 */
import { openLocalDb, isLocalDbSupported } from "@/lib/localDb/sqliteClient";
import { isLocalCatalogCacheEnabled } from "@/lib/localDb/localCacheGate";

function firstRow(result) {
  const row = result?.values?.[0];
  return row ?? null;
}

function rowField(row, key) {
  if (row == null) return null;
  if (typeof row === "object" && !Array.isArray(row)) return row[key] ?? null;
  return null;
}

/**
 * @param {object} menuDocument — shape from GET /api/menu/get-menu
 * @returns {Promise<boolean>}
 */
export async function saveMenuSnapshot(menuDocument) {
  if (!isLocalCatalogCacheEnabled() || !isLocalDbSupported()) return false;
  if (!menuDocument || typeof menuDocument !== "object") return false;

  try {
    const db = await openLocalDb();
    const payload = JSON.stringify(menuDocument);
    const updatedAt = Date.now();
    await db.run(
      "INSERT OR REPLACE INTO menu_snapshot (id, payload, updated_at) VALUES (1, ?, ?)",
      [payload, updatedAt],
    );
    return true;
  } catch (error) {
    console.error("saveMenuSnapshot:", error);
    return false;
  }
}

/**
 * @returns {Promise<{ payload: object, updatedAt: number } | null>}
 */
export async function readMenuSnapshot() {
  if (!isLocalDbSupported()) return null;

  try {
    const db = await openLocalDb();
    const result = await db.query(
      "SELECT payload, updated_at FROM menu_snapshot WHERE id = 1",
    );
    const row = firstRow(result);
    if (!row) return null;

    const rawPayload = rowField(row, "payload");
    const updatedAt = Number(rowField(row, "updated_at") || 0);
    if (!rawPayload || typeof rawPayload !== "string") return null;

    return {
      payload: JSON.parse(rawPayload),
      updatedAt,
    };
  } catch (error) {
    console.error("readMenuSnapshot:", error);
    return null;
  }
}
