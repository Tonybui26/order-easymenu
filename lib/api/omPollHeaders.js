/**
 * Headers so easymenu can log which store/surface is polling.
 * Values must stay simple tokens (see easymenu lib/logging/omPollLog.js).
 */

export const OM_CLIENT = {
  POS: "pos",
  ORDER_TERMINAL: "order-terminal",
};

export const OM_PURPOSE = {
  LIVE_ORDERS: "live-orders",
  KDS_COMPLETED: "kds-completed",
  COMPLETED_ORDERS: "completed-orders",
  ORDER_HISTORY: "order-history",
  SALES_SUMMARY: "sales-summary",
  HELD_ORDERS: "held-orders",
};

/**
 * @param {{ client?: string, purpose?: string }} meta
 * @param {Record<string, string>} [extra]
 */
export function omPollHeaders(meta = {}, extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (meta.client) headers["X-Om-Client"] = meta.client;
  if (meta.purpose) headers["X-Om-Purpose"] = meta.purpose;
  return headers;
}
