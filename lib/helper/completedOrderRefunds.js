/**
 * Summarize refund stats for the completed-orders trading day view.
 */

const REFUND_PAYMENT_STATUSES = new Set(["refunded", "partially_refunded"]);

/**
 * @param {Array<{ paymentStatus?: string, refund?: { amount?: number } }>} orders
 * @returns {{ refundCount: number, totalRefunded: number }}
 */
export function summarizeCompletedOrderRefunds(orders) {
  let refundCount = 0;
  let totalRefunded = 0;

  for (const order of orders || []) {
    if (!REFUND_PAYMENT_STATUSES.has(order?.paymentStatus)) continue;

    refundCount += 1;

    const amount = Number(order?.refund?.amount);
    if (Number.isFinite(amount) && amount > 0) {
      totalRefunded += amount;
    }
  }

  return { refundCount, totalRefunded };
}
