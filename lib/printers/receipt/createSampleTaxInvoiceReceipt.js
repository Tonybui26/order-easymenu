/**
 * Builds sample TAX INVOICE payload for receipt test printing.
 * @param {{ storeName?: string, storeABN?: string, phone?: string }} storeProfile
 */
export function createSampleTaxInvoiceReceipt(storeProfile = {}) {
  const store = {
    storeName: storeProfile.storeName || "Pho Thin Springvale",
    phone: storeProfile.phone || "03 8555 5888",
    storeABN: storeProfile.storeABN || "46 626 792 649",
  };

  const order = {
    orderType: "dine-in",
    table: "24",
    createdAt: new Date().toISOString(),
    items: [
      {
        name: "TAI LAN Stir Fries Rare Beef",
        quantity: 5,
        price: 14.5,
        selectedModifiers: [
          { optionName: "Modern-cooked", priceModifier: 0 },
          { optionName: "Less Noodle", priceModifier: 0 },
        ],
        selectedVariants: [],
      },
      {
        name: "Chicken Pho",
        quantity: 1,
        price: 17,
        selectedModifiers: [
          { optionName: "Extra chilli", priceModifier: 1 },
        ],
        selectedVariants: [],
      },
    ],
    subtotal: 89.5,
    discountPercent: 10,
    discountAmount: 8.95,
    total: 80.55,
    gstIncluded: 7.32,
    hasGstFreeItems: true,
    paymentMethod: "counter-cash",
    amountTendered: 100,
    changeDue: 19.45,
  };

  return {
    store,
    order,
    invoiceNo: "00032021122917",
  };
}
