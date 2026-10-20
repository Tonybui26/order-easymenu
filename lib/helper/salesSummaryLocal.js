/**
 * Paid sales still sitting in on-device storage, shaped like server orders
 * so the sales summary can total them with synced tickets.
 */

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

function saleTimeMs(record) {
  const fromPayload = Date.parse(record?.payload?.clientCreatedAt || "");
  if (Number.isFinite(fromPayload)) return fromPayload;
  const createdAt = Number(record?.createdAt);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function isCancelledLocalSend(record) {
  return String(record?.payload?.kitchenStatus || "").trim() === "cancelled";
}

function itemTotal(payload) {
  return (payload?.items || []).reduce(
    (sum, item) =>
      sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
}

function inRange(ms, startMs, endMs) {
  return Number.isFinite(ms) && ms >= startMs && ms <= endMs;
}

/**
 * @param {Array<object>} serverOrders
 * @param {object} record
 */
function alreadyOnServer(serverOrders, record) {
  const serverIds = new Set(
    (serverOrders || []).map((order) => String(order?._id || "")),
  );
  const localIds = new Set(
    (serverOrders || [])
      .map((order) => String(order?.clientLocalId || "").trim())
      .filter(Boolean),
  );
  const serverOrderId = String(record?.serverOrderId || "").trim();
  if (serverOrderId && serverIds.has(serverOrderId)) return true;
  const localId = String(record?.localId || "").trim();
  return Boolean(localId && localIds.has(localId));
}

function mapLocalTicket(record, method, includeTender) {
  const payload = record?.payload || {};
  const surchargeTotal = Number(payload.surchargeTotal || 0);
  const fee = includeTender ? Number(payload.processingFee || 0) : 0;
  const total = roundMoney(itemTotal(payload) + surchargeTotal + fee);
  const createdAt = new Date(saleTimeMs(record)).toISOString();

  return {
    _id: record.localId,
    clientLocalId: record.localId,
    posCheckId: record.posCheckId || payload.posCheckId || undefined,
    createdAt,
    paymentStatus: "paid",
    paymentMethod: method,
    total,
    discountAmount: payload.discountAmount,
    discountPercent: payload.discountPercent,
    discountType: payload.discountType,
    surcharges: Array.isArray(payload.surcharges) ? payload.surcharges : [],
    pendingSync: true,
    ...(includeTender
      ? {
          amountTendered: payload.amountTendered,
          changeDue: payload.changeDue,
          processingFee: fee,
        }
      : {}),
  };
}

function ordersFromRecords(records, method) {
  const ordered = [...records].sort(
    (a, b) => saleTimeMs(a) - saleTimeMs(b),
  );
  const tenderIndex = Math.max(0, ordered.length - 1);
  return ordered.map((record, index) =>
    mapLocalTicket(record, method, index === tenderIndex),
  );
}

/**
 * @param {{
 *   localSends?: Array<object>,
 *   pendingPayments?: Array<object>,
 *   serverOrders?: Array<object>,
 *   startMs: number,
 *   endMs: number,
 * }} input
 * @returns {Array<object>}
 */
export function pendingLocalSalesOrders({
  localSends = [],
  pendingPayments = [],
  serverOrders = [],
  startMs,
  endMs,
}) {
  const methodByLocalId = new Map();
  for (const payment of pendingPayments) {
    const method = String(payment?.method || "").trim();
    if (!method) continue;
    for (const id of payment.localIds || []) {
      const key = String(id);
      if (!methodByLocalId.has(key)) methodByLocalId.set(key, method);
    }
  }

  const includedLocalIds = new Set();
  const orders = [];
  const groups = new Map();

  for (const record of localSends) {
    if (!record?.localId || isCancelledLocalSend(record)) continue;
    if (alreadyOnServer(serverOrders, record)) continue;
    const ms = saleTimeMs(record);
    if (!inRange(ms, startMs, endMs)) continue;

    const method =
      String(record.payload?.paymentMethod || "").trim() ||
      methodByLocalId.get(String(record.localId)) ||
      "";
    const paid =
      String(record.payload?.paymentStatus || "").trim() === "paid" ||
      Boolean(method);
    if (!paid) continue;

    const key = String(record.posCheckId || record.localId);
    const list = groups.get(key);
    if (list) list.push(record);
    else groups.set(key, [record]);
  }

  for (const records of groups.values()) {
    const method =
      records
        .map(
          (record) =>
            String(record.payload?.paymentMethod || "").trim() ||
            methodByLocalId.get(String(record.localId)) ||
            "",
        )
        .find(Boolean) || "";
    if (!method) continue;
    for (const record of records) includedLocalIds.add(String(record.localId));
    orders.push(...ordersFromRecords(records, method));
  }

  for (const payment of pendingPayments) {
    const method = String(payment?.method || "").trim();
    if (!method) continue;
    const localIds = (payment.localIds || []).map((id) => String(id));
    if (localIds.some((id) => includedLocalIds.has(id))) continue;

    const records = localIds
      .map((id) => localSends.find((record) => record.localId === id))
      .filter(Boolean)
      .filter((record) => !alreadyOnServer(serverOrders, record));
    if (records.length === 0) continue;

    const ms = saleTimeMs(records[0]) || Number(payment.createdAt) || 0;
    if (!inRange(ms, startMs, endMs)) continue;

    for (const record of records) includedLocalIds.add(String(record.localId));
    orders.push(...ordersFromRecords(records, method));
  }

  return orders;
}
