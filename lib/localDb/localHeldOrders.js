/**
 * Build held-order / resume payloads from unsynced local Send/Pay rows so this
 * device still works when localDatabase keeps tickets off the server.
 */
import {
  listLocalSendRecords,
  listPendingOfflinePayments,
} from "@/lib/localDb/offlineSendStore";

export function isMongoObjectId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || "").trim());
}

function lineTotal(items) {
  return (items || []).reduce(
    (sum, item) =>
      sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
}

function resolveTables(payload) {
  const names = [];
  const seen = new Set();
  function push(value) {
    const name = String(value || "").trim();
    if (!name) return;
    const lower = name.toLowerCase();
    if (lower === "takeaway" || lower === "pickup") return;
    if (seen.has(lower)) return;
    seen.add(lower);
    names.push(name);
  }
  if (Array.isArray(payload?.tables)) payload.tables.forEach(push);
  push(payload?.table);
  return names;
}

function kitchenStatusFromPayload(payload) {
  const status = String(payload?.kitchenStatus || "").trim();
  return status || "preparing";
}

function buildEntryFromRecords(records, allPaid) {
  const ordered = [...records].sort((a, b) => a.createdAt - b.createdAt);
  const primary = ordered[0];
  const payload = primary.payload || {};
  const tables = resolveTables(payload);
  const table = tables[0] || String(payload.table || "").trim() || "";
  const total = ordered.reduce(
    (sum, record) => sum + lineTotal(record.payload?.items),
    0,
  );
  const rounded = Math.round(total * 100) / 100;
  const createdAt =
    payload.clientCreatedAt || new Date(primary.createdAt).toISOString();
  const orderIds = ordered.map((record) => record.localId);
  const tickets = ordered.map((record) => ({
    orderId: record.localId,
    status: kitchenStatusFromPayload(record.payload),
    paymentStatus: allPaid ? "paid" : "pending",
  }));
  const aggregateStatus = tickets.every(
    (ticket) => String(ticket.status || "").trim() === "delivered",
  )
    ? "delivered"
    : "preparing";

  return {
    id: `local:${primary.posCheckId || primary.localId}`,
    orderIds,
    posCheckId: primary.posCheckId || null,
    taxInvoiceNo: null,
    orderType: payload.orderType || "dine-in",
    table,
    tables: tables.length ? tables : table ? [table] : [],
    customerName: payload.customerName || "",
    source: "pos",
    tickets,
    aggregateStatus,
    status: aggregateStatus,
    total: rounded,
    discountAmount: 0,
    discountPercent: null,
    discountType: null,
    allPaid,
    amountDue: allPaid ? 0 : rounded,
    billPrinted: false,
    createdAt,
    heldAt: createdAt,
    orderCount: ordered.length,
    pendingSync: true,
  };
}

/**
 * Resume-shaped order docs from local_orders for drawer preview / Open / Pay.
 * Never send these ids to Mongo.
 *
 * @param {string[]} orderIds
 * @returns {Promise<object[]>}
 */
export async function loadLocalResumeOrders(orderIds) {
  const ids = [
    ...new Set(
      (orderIds || []).map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  if (ids.length === 0) return [];

  const localIds = ids.filter((id) => !isMongoObjectId(id));
  if (localIds.length === 0) return [];

  const [records, payments] = await Promise.all([
    listLocalSendRecords(),
    listPendingOfflinePayments(),
  ]);
  const byLocal = new Map(
    (records || []).map((record) => [record.localId, record]),
  );
  const paidLocalIds = new Set();
  for (const payment of payments || []) {
    for (const id of payment.localIds || []) {
      paidLocalIds.add(String(id));
    }
  }

  const orders = [];
  for (const localId of localIds) {
    const record = byLocal.get(localId);
    if (!record || record.serverOrderId) continue;
    const payload = record.payload || {};
    if (kitchenStatusFromPayload(payload) === "cancelled") continue;
    const allPaid = paidLocalIds.has(localId);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const total = Math.round(lineTotal(items) * 100) / 100;
    orders.push({
      _id: localId,
      clientLocalId: localId,
      createdAt:
        payload.clientCreatedAt || new Date(record.createdAt).toISOString(),
      customerName: payload.customerName || "",
      customerPhone: payload.customerPhone || "",
      customerEmail: payload.customerEmail || "",
      orderType: payload.orderType || "dine-in",
      table: payload.table,
      tables: payload.tables,
      posCheckId: record.posCheckId || payload.posCheckId || null,
      taxInvoiceNo: null,
      total,
      subtotal: total,
      discountAmount: 0,
      discountPercent: null,
      discountType: null,
      paymentStatus: allPaid ? "paid" : "pending",
      status: kitchenStatusFromPayload(payload),
      source: "pos",
      items,
      pendingSync: true,
    });
  }

  const byId = new Map(orders.map((order) => [String(order._id), order]));
  return localIds.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Unsynced local fires grouped as held checks (one entry per posCheckId).
 * Paid + delivered local checks are dropped (same as server held lifecycle).
 */
export async function buildLocalPendingHeldEntries() {
  const [records, payments] = await Promise.all([
    listLocalSendRecords(),
    listPendingOfflinePayments(),
  ]);

  const paidLocalIds = new Set();
  for (const payment of payments) {
    for (const id of payment.localIds || []) {
      paidLocalIds.add(String(id));
    }
  }

  const unsynced = (records || []).filter((record) => {
    if (record.status === "synced" || record.serverOrderId) return false;
    const kitchen = kitchenStatusFromPayload(record.payload);
    // Soft-cancelled locally — leave held like Mongo cancelled.
    if (kitchen === "cancelled") return false;
    const paid = paidLocalIds.has(String(record.localId));
    // Paid and served → leave held, same as Mongo delivered+paid.
    if (paid && kitchen === "delivered") return false;
    return true;
  });
  if (unsynced.length === 0) return [];

  const byCheck = new Map();
  for (const record of unsynced) {
    const key = record.posCheckId || record.localId;
    if (!byCheck.has(key)) byCheck.set(key, []);
    byCheck.get(key).push(record);
  }

  return [...byCheck.values()]
    .map((group) => {
      const allPaid = group.every((record) =>
        paidLocalIds.has(String(record.localId)),
      );
      return buildEntryFromRecords(group, allPaid);
    })
    .sort((a, b) => new Date(a.heldAt) - new Date(b.heldAt));
}

/**
 * Append local pending checks that are not already represented by server ids.
 * @param {object[]} serverHeld
 * @param {object[]} [localHeld]
 */
export function mergeHeldOrdersWithLocal(serverHeld, localHeld) {
  const server = Array.isArray(serverHeld) ? serverHeld : [];
  const local = Array.isArray(localHeld) ? localHeld : [];
  if (local.length === 0) return server;

  const serverIds = new Set();
  for (const entry of server) {
    for (const id of entry?.orderIds || []) {
      serverIds.add(String(id));
    }
  }

  const extras = local.filter(
    (entry) =>
      !(entry.orderIds || []).some((id) => serverIds.has(String(id))),
  );
  if (extras.length === 0) return server;
  return [...server, ...extras];
}

export async function withLocalPendingHeldOrders(heldOrders) {
  try {
    const local = await buildLocalPendingHeldEntries();
    return mergeHeldOrdersWithLocal(heldOrders, local);
  } catch (error) {
    console.error("withLocalPendingHeldOrders:", error);
    return Array.isArray(heldOrders) ? heldOrders : [];
  }
}
