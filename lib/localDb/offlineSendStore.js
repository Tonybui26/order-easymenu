/**
 * On-device queue for offline Send. Isolated from the live send path.
 *
 * A fire is saved here first (localId, empty server id). The outbox replays
 * it to POST /api/pos/orders/send-offline. That route returns the same Mongo
 * order if localId was already saved, so a lost response does not double.
 */
import { openLocalDb, isLocalDbSupported } from "@/lib/localDb/sqliteClient";
import { isLocalCatalogCacheEnabled } from "@/lib/localDb/localCacheGate";
import { isStoreOffline } from "@/lib/store/isOffline";
import { isStoreLocalDatabase } from "@/lib/store/isLocalDatabase";
import { isStoreSecondTest } from "@/lib/store/isSecondTest";
import { isStoreTesting } from "@/lib/store/isTesting";
import { syncOfflinePosSendAction, syncOfflinePosPaymentAction } from "@/lib/actions/offlineSendActions";
import { updatePosHeldCheckStatus } from "@/lib/api/fetchApi";

const listeners = new Set();
const paymentListeners = new Set();
let flushPromise = null;
let retryTimer = null;
/** When true, queue stays on device and flush/retry do nothing. */
let localDatabaseOnly = false;

function rowField(row, key) {
  if (row == null || typeof row !== "object" || Array.isArray(row)) return null;
  return row[key] ?? null;
}

function newDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Keep the outbox from uploading. Call from MenuContext when config applies.
 * Turning this off starts a flush so queued test rows can upload.
 * @param {boolean} enabled
 */
export function setLocalDatabaseOnly(enabled) {
  const wasOnly = localDatabaseOnly;
  localDatabaseOnly = enabled === true;
  if (localDatabaseOnly && retryTimer && typeof window !== "undefined") {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (wasOnly && !localDatabaseOnly) {
    void flushOfflineSendOutbox();
  }
}

export function isLocalDatabaseOnly() {
  return localDatabaseOnly;
}

/** True when Send/Pay should stay on device with no auto-sync. */
export function isLocalOnlySendMode(menuConfig) {
  return (
    isStoreLocalDatabase(menuConfig) || isStoreSecondTest(menuConfig)
  );
}

/**
 * Local-first Send/Pay.
 * - Offline mode or Local database: requires Testing store + native.
 * - Second test: native only (no Testing store required).
 */
export function isOfflineSendEnabled(menuConfig) {
  if (!isLocalDbSupported()) return false;
  if (isStoreSecondTest(menuConfig)) return true;
  return (
    (isStoreOffline(menuConfig) || isStoreLocalDatabase(menuConfig)) &&
    isStoreTesting(menuConfig)
  );
}

/** Background upload allowed only when not in local-only testing. */
export function isOfflineAutoSyncEnabled(menuConfig) {
  return (
    isOfflineSendEnabled(menuConfig) && !isLocalOnlySendMode(menuConfig)
  );
}

export function onOfflineSendSynced(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySynced(detail) {
  for (const listener of listeners) {
    try {
      listener(detail);
    } catch (error) {
      console.error("offline send listener:", error);
    }
  }
}

function notifyPaymentSynced(localPaymentId) {
  for (const listener of paymentListeners) {
    try {
      listener({ localPaymentId });
    } catch (error) {
      console.error("offline payment listener:", error);
    }
  }
}

export function onOfflinePaymentSynced(listener) {
  paymentListeners.add(listener);
  return () => paymentListeners.delete(listener);
}

async function insertLocalOrder(record) {
  const db = await openLocalDb();
  await db.run(
    `INSERT OR REPLACE INTO local_orders
      (local_id, server_order_id, pos_check_id, status, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      record.localId,
      record.serverOrderId || null,
      record.posCheckId,
      record.status,
      JSON.stringify(record.payload),
      record.createdAt,
      record.updatedAt,
    ],
  );
}

async function enqueueSend(localId, payload, createdAt) {
  const db = await openLocalDb();
  await db.run(
    `INSERT OR REPLACE INTO sync_outbox
      (id, type, payload, created_at, attempts, last_error, synced_at)
     VALUES (?, 'pos_send', ?, ?, 0, NULL, NULL)`,
    [localId, JSON.stringify(payload), createdAt],
  );
}

async function listPendingSends() {
  const db = await openLocalDb();
  const result = await db.query(
    `SELECT id, payload, attempts FROM sync_outbox
     WHERE type = 'pos_send' AND synced_at IS NULL
     ORDER BY created_at ASC`,
  );
  return result?.values || [];
}

async function markSendSynced(localId, serverOrderId) {
  const db = await openLocalDb();
  const now = Date.now();
  await db.run(
    `UPDATE sync_outbox SET synced_at = ?, last_error = NULL WHERE id = ?`,
    [now, localId],
  );
  await db.run(
    `UPDATE local_orders
     SET server_order_id = ?, status = 'synced', updated_at = ?
     WHERE local_id = ?`,
    [serverOrderId, now, localId],
  );
}

async function markSendFailed(localId, attempts, errorMessage) {
  const db = await openLocalDb();
  await db.run(
    `UPDATE sync_outbox SET attempts = ?, last_error = ? WHERE id = ?`,
    [attempts, String(errorMessage || "Sync failed").slice(0, 500), localId],
  );
  await db.run(
    `UPDATE local_orders SET status = 'pending', updated_at = ? WHERE local_id = ?`,
    [Date.now(), localId],
  );
}

/**
 * Local Send rows for history. Pending means the fire is not on the server yet.
 * @returns {Promise<Array<{ localId: string, serverOrderId: string, posCheckId: string, status: string, createdAt: number, payload: object }>>}
 */
export async function listLocalSendRecords() {
  if (!isLocalDbSupported()) return [];
  try {
    const db = await openLocalDb();
    const result = await db.query(
      `SELECT local_id, server_order_id, pos_check_id, status, payload, created_at
       FROM local_orders
       ORDER BY created_at DESC`,
    );
    return (result?.values || [])
      .map((row) => {
        const raw = rowField(row, "payload");
        let payload = {};
        if (typeof raw === "string") {
          try {
            payload = JSON.parse(raw);
          } catch {
            payload = {};
          }
        }
        return {
          localId: String(rowField(row, "local_id") || ""),
          serverOrderId: String(rowField(row, "server_order_id") || ""),
          posCheckId: String(rowField(row, "pos_check_id") || ""),
          status: String(rowField(row, "status") || ""),
          createdAt: Number(rowField(row, "created_at") || 0),
          payload,
        };
      })
      .filter((record) => record.localId);
  } catch (error) {
    console.error("listLocalSendRecords failed:", error);
    return [];
  }
}

/** Unsynced tenders. History stays yellow until these reach the server. */
export async function listPendingOfflinePayments() {
  if (!isLocalDbSupported()) return [];
  try {
    const db = await openLocalDb();
    const result = await db.query(
      `SELECT id, payload, created_at FROM sync_outbox
       WHERE type = 'pos_pay' AND synced_at IS NULL
       ORDER BY created_at DESC`,
    );
    return (result?.values || [])
      .map((row) => {
        const raw = rowField(row, "payload");
        let payload = {};
        if (typeof raw === "string") {
          try {
            payload = JSON.parse(raw);
          } catch {
            payload = {};
          }
        }
        return {
          localPaymentId: String(rowField(row, "id") || ""),
          createdAt: Number(rowField(row, "created_at") || 0),
          localIds: payload.localIds || [],
          orderIds: payload.orderIds || [],
          method: payload.method || "",
          amountTendered: Number(payload.amountTendered || 0),
        };
      })
      .filter((record) => record.localPaymentId);
  } catch (error) {
    console.error("listPendingOfflinePayments failed:", error);
    return [];
  }
}

/**
 * Remove unsynced local fires (and matching outbox / pay rows) from this device.
 * Used when staff delete a check that never reached Mongo.
 *
 * @param {string[]} localIds
 */
export async function cancelLocalPendingOrders(localIds) {
  const ids = [
    ...new Set(
      (localIds || []).map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  if (ids.length === 0 || !isLocalDbSupported()) {
    return { success: false, error: "No local tickets to delete" };
  }

  try {
    const db = await openLocalDb();
    const placeholders = ids.map(() => "?").join(", ");
    await db.run(
      `DELETE FROM local_orders WHERE local_id IN (${placeholders})`,
      ids,
    );
    await db.run(
      `DELETE FROM sync_outbox WHERE id IN (${placeholders})`,
      ids,
    );

    const payments = await listPendingOfflinePayments();
    for (const payment of payments) {
      const remainingLocal = (payment.localIds || []).filter(
        (id) => !ids.includes(String(id)),
      );
      const remainingServer = (payment.orderIds || []).filter(
        (id) => !ids.includes(String(id)),
      );
      if (remainingLocal.length === 0 && remainingServer.length === 0) {
        await db.run(`DELETE FROM sync_outbox WHERE id = ?`, [
          payment.localPaymentId,
        ]);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("cancelLocalPendingOrders failed:", error);
    return {
      success: false,
      error: error?.message || "Failed to delete local order",
    };
  }
}

/**
 * Set kitchen/service status on local tickets (All Served, Complete, Delete).
 * Keeps outbox rows so Send (and cancel/delivered) can sync like live.
 *
 * @param {string[]} localIds
 * @param {string} kitchenStatus
 * @param {{ cancelReason?: string }} [options]
 */
export async function markLocalOrdersKitchenStatus(
  localIds,
  kitchenStatus,
  options = {},
) {
  const ids = [
    ...new Set(
      (localIds || []).map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  const nextStatus = String(kitchenStatus || "").trim();
  if (ids.length === 0 || !nextStatus || !isLocalDbSupported()) {
    return { success: false, error: "No local tickets to update" };
  }

  try {
    const db = await openLocalDb();
    const placeholders = ids.map(() => "?").join(", ");
    const result = await db.query(
      `SELECT local_id, payload FROM local_orders WHERE local_id IN (${placeholders})`,
      ids,
    );
    const now = Date.now();
    const cancelReason =
      options.cancelReason != null
        ? String(options.cancelReason).trim()
        : "";

    for (const row of result?.values || []) {
      const localId = String(rowField(row, "local_id") || "");
      const raw = rowField(row, "payload");
      if (!localId || typeof raw !== "string") continue;
      let payload = {};
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = {};
      }
      payload.kitchenStatus = nextStatus;
      if (nextStatus === "cancelled") {
        payload.cancelReason = cancelReason;
      }
      const encoded = JSON.stringify(payload);
      await db.run(
        `UPDATE local_orders SET payload = ?, updated_at = ? WHERE local_id = ?`,
        [encoded, now, localId],
      );
      // Keep the outbox copy in sync — flush reads from sync_outbox, not local_orders.
      await db.run(
        `UPDATE sync_outbox SET payload = ? WHERE id = ? AND type = 'pos_send' AND synced_at IS NULL`,
        [encoded, localId],
      );
    }

    if (nextStatus === "cancelled") {
      await dropPendingPaymentsForLocalIds(ids);
    }

    return { success: true };
  } catch (error) {
    console.error("markLocalOrdersKitchenStatus failed:", error);
    return {
      success: false,
      error: error?.message || "Failed to update local order",
    };
  }
}

async function dropPendingPaymentsForLocalIds(localIds) {
  const payments = await listPendingOfflinePayments();
  const idSet = new Set(localIds.map(String));
  const db = await openLocalDb();
  for (const payment of payments) {
    const remainingLocal = (payment.localIds || []).filter(
      (id) => !idSet.has(String(id)),
    );
    const remainingServer = (payment.orderIds || []).filter(
      (id) => !idSet.has(String(id)),
    );
    if (remainingLocal.length === 0 && remainingServer.length === 0) {
      await db.run(`DELETE FROM sync_outbox WHERE id = ?`, [
        payment.localPaymentId,
      ]);
    }
  }
}

/**
 * Save the fire on this device and start a background sync.
 * Does not wait for Mongo. Caller prints and marks the cart sent immediately.
 *
 * @param {object} payload Live send body, without waiting for a server id.
 * @returns {Promise<{ success: boolean, localId?: string, posCheckId?: string, order?: object, pendingSync?: boolean, error?: string }>}
 */
export async function queueOfflinePosSend(payload) {
  if (!isLocalDbSupported() || !isLocalCatalogCacheEnabled()) {
    return { success: false, error: "Offline send requires the testing app" };
  }

  const localId = newDeviceId();
  const posCheckId = String(payload?.posCheckId || "").trim() || newDeviceId();
  const createdAt = Date.now();
  const stored = {
    ...payload,
    localId,
    posCheckId,
    clientCreatedAt: new Date(createdAt).toISOString(),
  };

  await insertLocalOrder({
    localId,
    serverOrderId: null,
    posCheckId,
    status: "pending",
    payload: stored,
    createdAt,
    updatedAt: createdAt,
  });
  await enqueueSend(localId, stored, createdAt);
  if (!localDatabaseOnly) {
    void flushOfflineSendOutbox();
  }

  return {
    success: true,
    pendingSync: true,
    localId,
    posCheckId,
    order: {
      _id: localId,
      clientLocalId: localId,
      posCheckId,
      orderType: stored.orderType,
      table: stored.table,
      tables: stored.tables,
      items: stored.items,
      customerName: stored.customerName,
      customerPhone: stored.customerPhone,
      customerEmail: stored.customerEmail,
      createdAt: stored.clientCreatedAt,
    source: "pos",
    pendingSync: true,
  },
  };
}

/**
 * Save the tender on this device. Sync runs after every ticket in localIds
 * has a server id. Pay-first and pay-later both use this.
 *
 * @param {{ localIds?: string[], orderIds?: string[], method: string, amountTendered: number, changeDue: number, processingFee?: number, discountAmount?: number, discountPercent?: number|null, discountType?: string|null }} payload
 */
export async function queueOfflinePosPayment(payload) {
  if (!isLocalDbSupported() || !isLocalCatalogCacheEnabled()) {
    return { success: false, error: "Offline pay requires the testing app" };
  }

  const localIds = [
    ...new Set((payload?.localIds || []).map((id) => String(id).trim()).filter(Boolean)),
  ];
  const orderIds = [
    ...new Set((payload?.orderIds || []).map((id) => String(id).trim()).filter(Boolean)),
  ];
  if (localIds.length === 0 && orderIds.length === 0) {
    return { success: false, error: "No tickets to pay" };
  }

  const method = String(payload?.method || "").trim();
  if (!method) {
    return { success: false, error: "Payment method is required" };
  }

  const localPaymentId = newDeviceId();
  const createdAt = Date.now();
  const stored = {
    localPaymentId,
    localIds,
    orderIds,
    method,
    amountTendered: Number(payload.amountTendered || 0),
    changeDue: Number(payload.changeDue || 0),
    processingFee: Number(payload.processingFee || 0),
    discountAmount: payload.discountAmount,
    discountPercent: payload.discountPercent ?? null,
    discountType: payload.discountType ?? null,
  };

  const db = await openLocalDb();
  await db.run(
    `INSERT OR REPLACE INTO sync_outbox
      (id, type, payload, created_at, attempts, last_error, synced_at)
     VALUES (?, 'pos_pay', ?, ?, 0, NULL, NULL)`,
    [localPaymentId, JSON.stringify(stored), createdAt],
  );
  // Stamp tender onto local tickets so history/resume show method while still pending.
  await stampLocalOrdersPaid(localIds, stored);
  if (!localDatabaseOnly) {
    void flushOfflineSendOutbox();
  }
  return { success: true, pendingSync: true, localPaymentId };
}

/**
 * Write paymentMethod / paid status onto local_orders (+ unsynced send outbox)
 * so UI can show tender before sync completes.
 */
async function stampLocalOrdersPaid(localIds, tender) {
  const ids = [
    ...new Set((localIds || []).map((id) => String(id || "").trim()).filter(Boolean)),
  ];
  if (ids.length === 0 || !isLocalDbSupported()) return;

  const db = await openLocalDb();
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db.query(
    `SELECT local_id, payload FROM local_orders WHERE local_id IN (${placeholders})`,
    ids,
  );
  const now = Date.now();
  for (const row of result?.values || []) {
    const localId = String(rowField(row, "local_id") || "");
    const raw = rowField(row, "payload");
    if (!localId || typeof raw !== "string") continue;
    let payload = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
    payload.paymentStatus = "paid";
    payload.paymentMethod = tender.method;
    payload.amountTendered = tender.amountTendered;
    payload.changeDue = tender.changeDue;
    payload.processingFee = tender.processingFee;
    if (tender.discountAmount != null) {
      payload.discountAmount = tender.discountAmount;
      payload.discountPercent = tender.discountPercent ?? null;
      payload.discountType = tender.discountType ?? null;
    }
    const encoded = JSON.stringify(payload);
    await db.run(
      `UPDATE local_orders SET payload = ?, updated_at = ? WHERE local_id = ?`,
      [encoded, now, localId],
    );
    await db.run(
      `UPDATE sync_outbox SET payload = ? WHERE id = ? AND type = 'pos_send' AND synced_at IS NULL`,
      [encoded, localId],
    );
  }
}

/**
 * Replay unsynced fires in order. Stops on the first failure so a later fire
 * on the same check cannot land before the earlier one.
 */
export function flushOfflineSendOutbox() {
  if (localDatabaseOnly) return Promise.resolve();
  if (flushPromise) {
    return flushPromise.finally(() => flushOfflineSendOutbox());
  }
  flushPromise = runFlush().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function runFlush() {
  if (!isLocalDbSupported() || !isLocalCatalogCacheEnabled()) return;

  const pending = await listPendingSends();
  for (const row of pending) {
    const localId = String(rowField(row, "id") || "");
    const raw = rowField(row, "payload");
    const attempts = Number(rowField(row, "attempts") || 0) + 1;
    if (!localId || typeof raw !== "string") continue;

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      await markSendFailed(localId, attempts, "Invalid local payload");
      break;
    }

    const result = await syncOfflinePosSendAction(payload);
    const serverOrderId = String(result?.order?._id || "").trim();
    if (!result?.success || !serverOrderId) {
      await markSendFailed(localId, attempts, result?.error || "Sync failed");
      if (attempts < 12 && typeof window !== "undefined") {
        if (!retryTimer) {
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            void flushOfflineSendOutbox();
          }, Math.min(attempts, 6) * 5000);
        }
      }
      break;
    }

    await markSendSynced(localId, serverOrderId);
    notifySynced({
      localId,
      serverOrderId,
      posCheckId: String(result.order?.posCheckId || payload.posCheckId || ""),
      taxInvoiceNo: String(result.order?.taxInvoiceNo || ""),
      order: result.order,
    });

    const kitchenStatus = String(payload.kitchenStatus || "").trim();
    if (kitchenStatus === "cancelled" || kitchenStatus === "delivered") {
      const statusResult = await updatePosHeldCheckStatus({
        orderIds: [serverOrderId],
        status: kitchenStatus,
        cancelReason: payload.cancelReason || undefined,
        requireCancelReason: kitchenStatus === "cancelled",
      });
      if (!statusResult?.success) {
        console.error(
          "offline send status sync failed:",
          statusResult?.error || kitchenStatus,
        );
      }
    }
  }

  await flushReadyPayments();
}

async function serverIdsForLocalIds(localIds) {
  if (!localIds.length) return [];
  const db = await openLocalDb();
  const placeholders = localIds.map(() => "?").join(", ");
  const result = await db.query(
    `SELECT local_id, server_order_id FROM local_orders WHERE local_id IN (${placeholders})`,
    localIds,
  );
  const byLocal = new Map();
  for (const row of result?.values || []) {
    byLocal.set(
      String(rowField(row, "local_id") || ""),
      String(rowField(row, "server_order_id") || ""),
    );
  }
  const serverIds = [];
  for (const localId of localIds) {
    const serverId = byLocal.get(localId);
    if (!serverId) return null;
    serverIds.push(serverId);
  }
  return serverIds;
}

async function listPendingPayments() {
  const db = await openLocalDb();
  const result = await db.query(
    `SELECT id, payload, attempts FROM sync_outbox
     WHERE type = 'pos_pay' AND synced_at IS NULL
     ORDER BY created_at ASC`,
  );
  return result?.values || [];
}

async function markPaymentSynced(localPaymentId) {
  const db = await openLocalDb();
  await db.run(
    `UPDATE sync_outbox SET synced_at = ?, last_error = NULL WHERE id = ?`,
    [Date.now(), localPaymentId],
  );
}

async function flushReadyPayments() {
  const pending = await listPendingPayments();
  for (const row of pending) {
    const localPaymentId = String(rowField(row, "id") || "");
    const raw = rowField(row, "payload");
    const attempts = Number(rowField(row, "attempts") || 0) + 1;
    if (!localPaymentId || typeof raw !== "string") continue;

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      await markSendFailed(localPaymentId, attempts, "Invalid local tender");
      continue;
    }

    const resolved = await serverIdsForLocalIds(payload.localIds || []);
    if (!resolved) continue;

    const result = await syncOfflinePosPaymentAction({
      ...payload,
      orderIds: [...new Set([...(payload.orderIds || []), ...resolved])],
    });
    if (result?.waiting) continue;
    if (!result?.success) {
      await markSendFailed(
        localPaymentId,
        attempts,
        result?.error || "Tender sync failed",
      );
      if (attempts < 12 && typeof window !== "undefined" && !retryTimer) {
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          void flushOfflineSendOutbox();
        }, Math.min(attempts, 6) * 5000);
      }
      continue;
    }
    await markPaymentSynced(localPaymentId);
    notifyPaymentSynced(localPaymentId);
  }
}
