import { createSampleTaxInvoiceReceipt } from "./createSampleTaxInvoiceReceipt";

/**
 * Sample BILL payload for receipt test printing (no tender / change lines).
 * @param {{ storeName?: string, storeABN?: string, phone?: string, storeLogo?: string }} storeProfile
 */
export function createSampleBillReceipt(storeProfile = {}) {
  const payload = createSampleTaxInvoiceReceipt(storeProfile);
  const order = { ...payload.order };

  delete order.paymentMethod;
  delete order.amountTendered;
  delete order.changeDue;

  return {
    ...payload,
    documentTitle: "BILL",
    includeTender: false,
    order,
  };
}
