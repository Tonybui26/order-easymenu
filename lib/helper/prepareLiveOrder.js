import { updateOrderStatus } from "@/lib/api/fetchApi";
import { isCounterPayment } from "@/lib/helper/payLater";
import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";

function getOrderShortId(order) {
  return String(order?._id || "")
    .slice(-6)
    .toUpperCase();
}

/**
 * Same prepare path as Live Order Terminal: status → preparing, then always
 * kitchen print (covers auto-print miss/failure for orders still in New).
 */
export async function prepareOrderForKitchen(
  order,
  { storeProfile, menuConfig, itemGroups, ownerEmail },
) {
  if (!order?._id) {
    return { success: false, message: "Order not found" };
  }

  const updatedOrder = await updateOrderStatus(order._id, "preparing");

  if (storeProfile && ownerEmail) {
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

/**
 * Auto-print path for paid QR/online orders: print first, then move to preparing
 * only when print succeeds (option A). Suppresses the generic print success toast
 * so the caller can show "Order #ABC printed".
 */
export async function autoPrintAndPrepareOrder(
  order,
  { storeProfile, menuConfig, itemGroups, showCustomToast = null },
) {
  if (!order?._id) {
    return {
      success: false,
      printed: false,
      prepared: false,
      message: "Order not found",
    };
  }

  const shortId = getOrderShortId(order);
  const printResult = await printKitchenOrder(order, {
    storeProfile,
    itemGroups,
    menuConfig,
    source: "auto_print",
    notifySuccess: false,
    ...(showCustomToast ? { showCustomToast } : {}),
  });

  if (!printResult?.success) {
    return {
      success: false,
      printed: false,
      prepared: false,
      printResult,
      shortId,
      message: printResult?.message || "Print failed",
    };
  }

  try {
    const updatedOrder = await updateOrderStatus(order._id, "preparing");
    return {
      success: true,
      printed: true,
      prepared: true,
      printResult,
      updatedOrder,
      shortId,
      message: `Order #${shortId} printed`,
    };
  } catch (error) {
    console.error(
      `[auto-print] Order ${shortId} printed but status update failed:`,
      error,
    );
    return {
      success: false,
      printed: true,
      prepared: false,
      printResult,
      shortId,
      error,
      message: `Order #${shortId} printed but could not move to Preparing`,
    };
  }
}

/** Pending counter (pay-later) — excluded from auto-print; keep manual Prepare. */
export function isAutoPrintExcludedPayLaterOrder(order) {
  return (
    order?.paymentStatus === "pending" &&
    isCounterPayment(order?.paymentMethod)
  );
}
