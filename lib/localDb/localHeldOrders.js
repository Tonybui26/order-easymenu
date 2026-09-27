/**
 * Build held-order / resume payloads from unsynced local Send/Pay rows so this
 * device still works when localDatabase keeps tickets off the server.
 *
 * Grouping mirrors online `buildPosHeldOrderEntries`:
 * - single-seat table tickets → one held entry per table
 * - multi-seat merges → one entry per posCheckId
 * - counter takeaway/delivery (no table) → one entry per posCheckId
 */
import {
  listLocalSendRecords,
  listPendingOfflinePayments,
} from "@/lib/localDb/offlineSendStore";

export function isMongoObjectId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || "").trim());
}

function lineTotal(items) {
  return (items || []).reduce((sum, item) => {
    if (String(item?.kitchenStatus || "").trim() === "cancelled") return sum;
    return sum + Number(item?.price || 0) * Number(item?.quantity || 0);
  }, 0);
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

function resolveTablesFromRecord(record) {
  return resolveTables(record?.payload || {});
}

function isMultiSeatRecord(record) {
  return resolveTablesFromRecord(record).length >= 2;
}

function isTableLinkedRecord(record) {
  return resolveTablesFromRecord(record).length >= 1;
}

function kitchenStatusFromPayload(payload) {
  const status = String(payload?.kitchenStatus || "").trim();
  return status || "preparing";
}

function isRecordPaid(record, paidLocalIds) {
  return (
    paidLocalIds.has(String(record?.localId || "")) ||
    String(record?.payload?.paymentStatus || "").trim() === "paid"
  );
}

function paymentMethodFromRecord(record, paymentByLocalId) {
  const fromPayload = String(record?.payload?.paymentMethod || "").trim();
  if (fromPayload) return fromPayload;
  return paymentByLocalId?.get(String(record?.localId || "")) || null;
}

function paymentMethodFromRecords(records, paymentByLocalId) {
  for (const record of records) {
    const method = paymentMethodFromRecord(record, paymentByLocalId);
    if (method) return method;
  }
  return null;
}

function buildEntryFromRecords(
  records,
  paidLocalIds,
  paymentByLocalId,
  { id, posCheckId, table: tableOverride, tables: tablesOverride } = {},
) {
  const ordered = [...records].sort((a, b) => a.createdAt - b.createdAt);
  const primary = ordered[0];
  const payload = primary.payload || {};
  const tablesFromPayload = resolveTablesFromRecord(primary);
  const tables =
    Array.isArray(tablesOverride) && tablesOverride.length > 0
      ? tablesOverride
      : tablesFromPayload;
  const table =
    String(tableOverride || "").trim() ||
    tables[0] ||
    String(payload.table || "").trim() ||
    "";
  const total = ordered.reduce(
    (sum, record) => sum + lineTotal(record.payload?.items),
    0,
  );
  const rounded = Math.round(total * 100) / 100;
  const createdAt =
    payload.clientCreatedAt || new Date(primary.createdAt).toISOString();
  const orderIds = ordered.map((record) => record.localId);

  const tickets = ordered.map((record) => {
    const paid = isRecordPaid(record, paidLocalIds);
    const paymentMethod = paid
      ? paymentMethodFromRecord(record, paymentByLocalId)
      : null;
    return {
      orderId: record.localId,
      status: kitchenStatusFromPayload(record.payload),
      paymentStatus: paid ? "paid" : "pending",
      ...(paymentMethod ? { paymentMethod } : {}),
    };
  });
  const allPaid = tickets.every(
    (ticket) => String(ticket.paymentStatus || "").trim() === "paid",
  );
  const paymentMethod = allPaid
    ? paymentMethodFromRecords(ordered, paymentByLocalId)
    : null;
  const aggregateStatus = tickets.every(
    (ticket) => String(ticket.status || "").trim() === "delivered",
  )
    ? "delivered"
    : "preparing";

  const resolvedPosCheckId =
    posCheckId !== undefined ? posCheckId : primary.posCheckId || null;
  const entryId =
    String(id || "").trim() ||
    `local:${resolvedPosCheckId || primary.localId}`;

  // Prefer dine-in when any fire on the seat is dine-in (matches online).
  const hasDineIn = ordered.some(
    (record) =>
      String(record?.payload?.orderType || "").trim() === "dine-in",
  );
  const orderType = hasDineIn
    ? "dine-in"
    : String(payload.orderType || "pick-up").trim() || "pick-up";

  return {
    id: entryId,
    orderIds,
    posCheckId: resolvedPosCheckId,
    taxInvoiceNo: null,
    orderType,
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
    ...(paymentMethod ? { paymentMethod } : {}),
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
  const methodByLocalId = new Map();
  for (const payment of payments || []) {
    const method = String(payment.method || "").trim();
    for (const id of payment.localIds || []) {
      const key = String(id);
      paidLocalIds.add(key);
      if (method && !methodByLocalId.has(key)) methodByLocalId.set(key, method);
    }
  }

  const orders = [];
  for (const localId of localIds) {
    const record = byLocal.get(localId);
    if (!record || record.serverOrderId) continue;
    const payload = record.payload || {};
    if (kitchenStatusFromPayload(payload) === "cancelled") continue;
    const allPaid = isRecordPaid(record, paidLocalIds);
    const paymentMethod = allPaid
      ? paymentMethodFromRecord(record, methodByLocalId)
      : null;
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
      discountAmount: Number(payload.discountAmount || 0),
      discountPercent: payload.discountPercent ?? null,
      discountType: payload.discountType ?? null,
      paymentStatus: allPaid ? "paid" : "pending",
      ...(paymentMethod ? { paymentMethod } : {}),
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
 * Unsynced local fires grouped like online held checks.
 * Paid + delivered local checks are dropped (same as server held lifecycle).
 */
export async function buildLocalPendingHeldEntries() {
  const [records, payments] = await Promise.all([
    listLocalSendRecords(),
    listPendingOfflinePayments(),
  ]);

  const paidLocalIds = new Set();
  const methodByLocalId = new Map();
  for (const payment of payments) {
    const method = String(payment.method || "").trim();
    for (const id of payment.localIds || []) {
      const key = String(id);
      paidLocalIds.add(key);
      if (method && !methodByLocalId.has(key)) methodByLocalId.set(key, method);
    }
  }

  const unsynced = (records || []).filter((record) => {
    if (record.status === "synced" || record.serverOrderId) return false;
    const kitchen = kitchenStatusFromPayload(record.payload);
    // Soft-cancelled locally — leave held like Mongo cancelled.
    if (kitchen === "cancelled") return false;
    const paid = isRecordPaid(record, paidLocalIds);
    // Paid and served → leave held, same as Mongo delivered+paid.
    if (paid && kitchen === "delivered") return false;
    return true;
  });
  if (unsynced.length === 0) return [];

  const multiSeatCheckIds = new Set();
  for (const record of unsynced) {
    if (!isTableLinkedRecord(record) || !isMultiSeatRecord(record)) continue;
    const posCheckId = String(record.posCheckId || "").trim();
    if (posCheckId) multiSeatCheckIds.add(posCheckId);
  }

  const byTable = new Map();
  const byMultiSeatCheck = new Map();
  const byPosCheckId = new Map();

  for (const record of unsynced) {
    const posCheckId = String(record.posCheckId || "").trim();

    if (isTableLinkedRecord(record)) {
      if (posCheckId && multiSeatCheckIds.has(posCheckId)) {
        if (!byMultiSeatCheck.has(posCheckId)) {
          byMultiSeatCheck.set(posCheckId, []);
        }
        byMultiSeatCheck.get(posCheckId).push(record);
        continue;
      }

      const table = resolveTablesFromRecord(record)[0];
      if (!byTable.has(table)) byTable.set(table, []);
      byTable.get(table).push(record);
      continue;
    }

    const checkKey = posCheckId || record.localId;
    if (!byPosCheckId.has(checkKey)) byPosCheckId.set(checkKey, []);
    byPosCheckId.get(checkKey).push(record);
  }

  const mergedTables = [...byTable.entries()].map(([table, group]) => {
    const allTables = [];
    const seen = new Set();
    for (const record of group) {
      for (const name of resolveTablesFromRecord(record)) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        allTables.push(name);
      }
    }
    return buildEntryFromRecords(group, paidLocalIds, methodByLocalId, {
      id: `local:table:${table}`,
      posCheckId: null,
      table,
      tables: allTables.length ? allTables : [table],
    });
  });

  const mergedMultiSeat = [...byMultiSeatCheck.entries()].map(
    ([posCheckId, group]) =>
      buildEntryFromRecords(group, paidLocalIds, methodByLocalId, {
        id: `local:check:${posCheckId}`,
        posCheckId,
      }),
  );

  const mergedChecks = [...byPosCheckId.entries()].map(([posCheckId, group]) =>
    buildEntryFromRecords(group, paidLocalIds, methodByLocalId, {
      id: `local:check:${posCheckId}`,
      posCheckId: String(group[0]?.posCheckId || "").trim() || null,
    }),
  );

  return [...mergedTables, ...mergedMultiSeat, ...mergedChecks].sort(
    (a, b) => new Date(a.heldAt) - new Date(b.heldAt),
  );
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
