/** Order still paid for kitchen / new-tab flow (partial refund — order remains active). */
export function isOrderPaidForFulfillment(paymentStatus) {
  return (
    paymentStatus === "paid" || paymentStatus === "partially_refunded"
  );
}
