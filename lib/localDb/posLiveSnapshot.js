/**
 * Last held-orders list + resume payloads for POS screens (table map, Held
 * Orders, resume a check, drawer preview).
 *
 * Cache miss (nothing local): fetch the server, show that, then write SQLite.
 * Cache hit: caller paints local immediately, then this module refreshes in
 * the background and overwrites SQLite. A failed refresh keeps the last good
 * copy.
 *
 * Gated by isTesting + native. Otherwise callers should keep using the API.
 */
import { openLocalDb, isLocalDbSupported } from "@/lib/localDb/sqliteClient";
import { isLocalCatalogCacheEnabled } from "@/lib/localDb/localCacheGate";

/** @type {Map<string, object[]>} */
const memoryResume = new Map();

function firstRow(result) {
  return result?.values?.[0] ?? null;
}

function rowField(row, key) {
  if (row == null || typeof row !== "object" || Array.isArray(row)) return null;
  return row[key] ?? null;
}

export function resumeOrdersCacheKey(orderIds) {
  return (orderIds || [])
    .map((id) => String(id).trim())
    .filter(Boolean)
    .join(",");
}

export function getMemoryResumeOrders(orderIds) {
  const key = resumeOrdersCacheKey(orderIds);
  if (!key) return null;
  return memoryResume.get(key) || null;
}

function rememberResumeOrders(orderIds, orders) {
  const key = resumeOrdersCacheKey(orderIds);
  if (!key || !Array.isArray(orders)) return;
  memoryResume.set(key, orders);
}

export async function readHeldOrdersSnapshot() {
  if (!isLocalCatalogCacheEnabled() || !isLocalDbSupported()) return null;
  try {
    const db = await openLocalDb();
    const result = await db.query(
      "SELECT payload FROM held_orders_snapshot WHERE id = 1",
    );
    const raw = rowField(firstRow(result), "payload");
    if (!raw || typeof raw !== "string") return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error("readHeldOrdersSnapshot:", error);
    return null;
  }
}

export async function saveHeldOrdersSnapshot(heldOrders) {
  if (!isLocalCatalogCacheEnabled() || !isLocalDbSupported()) return false;
  if (!Array.isArray(heldOrders)) return false;
  try {
    const db = await openLocalDb();
    await db.run(
      "INSERT OR REPLACE INTO held_orders_snapshot (id, payload, updated_at) VALUES (1, ?, ?)",
      [JSON.stringify(heldOrders), Date.now()],
    );
    return true;
  } catch (error) {
    console.error("saveHeldOrdersSnapshot:", error);
    return false;
  }
}

export async function readResumeOrdersSnapshot(orderIds) {
  const memory = getMemoryResumeOrders(orderIds);
  if (memory) return memory;
  if (!isLocalCatalogCacheEnabled() || !isLocalDbSupported()) return null;

  const key = resumeOrdersCacheKey(orderIds);
  if (!key) return null;

  try {
    const db = await openLocalDb();
    const result = await db.query(
      "SELECT payload FROM resume_orders_snapshot WHERE cache_key = ?",
      [key],
    );
    const raw = rowField(firstRow(result), "payload");
    if (!raw || typeof raw !== "string") return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    rememberResumeOrders(orderIds, parsed);
    return parsed;
  } catch (error) {
    console.error("readResumeOrdersSnapshot:", error);
    return null;
  }
}

export async function saveResumeOrdersSnapshot(orderIds, orders) {
  if (!Array.isArray(orders) || orders.length === 0) return false;
  rememberResumeOrders(orderIds, orders);
  if (!isLocalCatalogCacheEnabled() || !isLocalDbSupported()) return false;

  const key = resumeOrdersCacheKey(orderIds);
  if (!key) return false;

  try {
    const db = await openLocalDb();
    await db.run(
      "INSERT OR REPLACE INTO resume_orders_snapshot (cache_key, payload, updated_at) VALUES (?, ?, ?)",
      [key, JSON.stringify(orders), Date.now()],
    );
    return true;
  } catch (error) {
    console.error("saveResumeOrdersSnapshot:", error);
    return false;
  }
}

/** Probe ages for Settings. Does not dump order payloads. */
export async function readPosLiveSnapshotMeta() {
  if (!isLocalCatalogCacheEnabled() || !isLocalDbSupported()) return null;
  try {
    const db = await openLocalDb();
    const held = await db.query(
      "SELECT payload, updated_at FROM held_orders_snapshot WHERE id = 1",
    );
    const heldRow = firstRow(held);
    const heldRaw = rowField(heldRow, "payload");
    let heldCount = 0;
    if (typeof heldRaw === "string") {
      const parsed = JSON.parse(heldRaw);
      heldCount = Array.isArray(parsed) ? parsed.length : 0;
    }
    const heldUpdatedAt = Number(rowField(heldRow, "updated_at")) || null;

    const resumes = await db.query("SELECT cache_key FROM resume_orders_snapshot");
    return {
      heldOrders: heldUpdatedAt
        ? { updatedAt: heldUpdatedAt, count: heldCount }
        : null,
      resumeSnapshots: resumes?.values?.length ?? 0,
    };
  } catch (error) {
    console.error("readPosLiveSnapshotMeta:", error);
    return null;
  }
}

/**
 * Paint local held orders if present, then fetch and overwrite the snapshot.
 * Missing local copy falls through to the network fetch.
 *
 * @param {() => Promise<{ success?: boolean, heldOrders?: object[], error?: string }>} fetchHeld
 * @param {{ onHeld: (heldOrders: object[]) => void, paintLocalFirst?: boolean }} handlers
 */
export async function hydrateHeldOrders(fetchHeld, { onHeld, paintLocalFirst = true }) {
  if (!isLocalCatalogCacheEnabled()) {
    const result = await fetchHeld();
    if (result?.success) onHeld(result.heldOrders || []);
    return result;
  }

  let paintedLocal = false;
  if (paintLocalFirst) {
    const local = await readHeldOrdersSnapshot();
    if (local) {
      onHeld(local);
      paintedLocal = true;
    }
  }

  try {
    const result = await fetchHeld();
    if (result?.success) {
      const next = result.heldOrders || [];
      onHeld(next);
      await saveHeldOrdersSnapshot(next);
      return result;
    }
    if (paintedLocal) return { success: true, fromCache: true };
    return result ?? { success: false };
  } catch (error) {
    if (paintedLocal) return { success: true, fromCache: true };
    throw error;
  }
}

/**
 * Paint local resume orders if present, then fetch and overwrite.
 * Missing local copy fetches first, then saves.
 *
 * @param {string[]} orderIds
 * @param {() => Promise<{ success?: boolean, orders?: object[], error?: string }>} fetchResume
 * @param {{ onOrders: (orders: object[]) => void }} handlers
 */
export async function hydrateResumeOrders(orderIds, fetchResume, { onOrders }) {
  if (!isLocalCatalogCacheEnabled()) {
    const result = await fetchResume();
    if (result?.success && result.orders?.length) onOrders(result.orders);
    return result;
  }

  const local = await readResumeOrdersSnapshot(orderIds);
  if (local?.length) onOrders(local);

  try {
    const result = await fetchResume();
    if (result?.success && result.orders?.length) {
      onOrders(result.orders);
      await saveResumeOrdersSnapshot(orderIds, result.orders);
      return result;
    }
    if (local?.length) return { success: true, orders: local, fromCache: true };
    return result ?? { success: false };
  } catch (error) {
    if (local?.length) return { success: true, orders: local, fromCache: true };
    throw error;
  }
}
