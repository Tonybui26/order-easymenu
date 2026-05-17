import { isCounterPayment } from "@/lib/helper/payLater";

/** Amount staff should collect at counter (order.total is inclusive of surcharges). */

export function isPendingCounterOrderForCollection(order) {
  return (
    order?.paymentStatus === "pending" && isCounterPayment(order.paymentMethod)
  );
}

export function getOrderAmountToCollect(order) {
  return Number(order?.total ?? 0);
}

export function getCollectAmountSummary(orders, filterFn) {
  const list = filterFn ? orders.filter(filterFn) : orders;
  const total = list.reduce((sum, order) => sum + getOrderAmountToCollect(order), 0);
  const surchargeTotal = list.reduce(
    (sum, order) => sum + Number(order?.surchargeTotal ?? 0),
    0,
  );
  return { total, surchargeTotal, orderCount: list.length };
}
