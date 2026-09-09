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
 * Auto-print path for paid QR/online orders: move to preparing immediately,
 * then kitchen-print in the background (retries + error toasts). Matches
 * manual Prepare so Table Map alerts can dismiss without waiting on printers.
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

  try {
    const updatedOrder = await updateOrderStatus(order._id, "preparing");

    if (storeProfile) {
      void printKitchenOrder(updatedOrder, {
        storeProfile,
        itemGroups,
        menuConfig,
        source: "auto_print",
        notifySuccess: false,
        ...(showCustomToast ? { showCustomToast } : {}),
      }).catch((error) => {
        console.error(
          `[auto-print] Kitchen print failed for order ${shortId}:`,
          error,
        );
      });
    }

    return {
      success: true,
      printed: true,
      prepared: true,
      updatedOrder,
      shortId,
      message: `Order #${shortId} sent to kitchen`,
    };
  } catch (error) {
    console.error(
      `[auto-print] Order ${shortId} could not move to Preparing:`,
      error,
    );
    return {
      success: false,
      printed: false,
      prepared: false,
      shortId,
      error,
      message: `Order #${shortId} could not move to Preparing`,
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
