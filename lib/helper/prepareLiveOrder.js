import { updateOrderStatus } from "@/lib/api/fetchApi";
import { isCounterPayment } from "@/lib/helper/payLater";
import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";

/**
 * Same prepare path as Live Order Terminal: status → preparing, then kitchen print
 * when counter order or auto-print is off.
 */
export async function prepareOrderForKitchen(
  order,
  { storeProfile, menuConfig, itemGroups, ownerEmail },
) {
  if (!order?._id) {
    return { success: false, message: "Order not found" };
  }

  const updatedOrder = await updateOrderStatus(order._id, "preparing");

  const autoPrintingEnabled = Boolean(menuConfig?.autoPrinting?.enabled);
  const isCounterOrder = isCounterPayment(order.paymentMethod);

  if (storeProfile && ownerEmail && (isCounterOrder || !autoPrintingEnabled)) {
    void printKitchenOrder(updatedOrder, {
      storeProfile,
      itemGroups,
      menuConfig,
      source: "prepare",
    }).catch((error) => {
      console.error("[prepare] Kitchen print failed:", error);
    });
  }

  return { success: true, updatedOrder };
}
