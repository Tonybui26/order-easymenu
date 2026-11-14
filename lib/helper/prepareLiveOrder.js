import { logPrintError, updateOrderStatus } from "@/lib/api/fetchApi";
import { isCounterPayment } from "@/lib/helper/payLater";
import { getPlatform } from "@/lib/helper/platformDetection";
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
  { storeProfile, menuConfig, itemGroups, menuContent, ownerEmail },
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
      menuContent,
      source: "prepare",
    }).catch((error) => {
      console.error("[prepare] Kitchen print failed:", error);
    });
  }

  return { success: true, updatedOrder };
}

/**
 * Log a suppressed duplicate auto-print (lost server claim) for later diagnosis.
 * Does not print; appears in power-admin printing logs as source auto_print_claim_lost.
 */
function reportAutoPrintClaimLost(order, { autoPrintedAt = null, status = null } = {}) {
  const orderId = order?._id ? String(order._id) : "";
  if (!orderId) return;

  const shortId = orderId.slice(-6);
  const statusPart = status ? ` status=${status}` : "";
  const claimedPart = autoPrintedAt
    ? ` autoPrintedAt=${new Date(autoPrintedAt).toISOString()}`
    : "";

  logPrintError({
    type: "print_error",
    orderId,
    orderShortId: shortId,
    message: `Auto-print claim lost (duplicate suppressed).${statusPart}${claimedPart}`,
    failedPrinters: [],
    successfulPrints: 0,
    failedPrints: 0,
    totalPrinters: 0,
    attempt: "final",
    source: "auto_print_claim_lost",
    platform: getPlatform(),
  }).catch(() => {});
}

/**
 * Auto-print path for paid QR/online orders: atomic server claim → preparing,
 * then kitchen-print in the background. A lost claim skips printing and logs
 * `auto_print_claim_lost` so duplicates can still be investigated.
 */
export async function autoPrintAndPrepareOrder(
  order,
  { storeProfile, menuConfig, itemGroups, menuContent, showCustomToast = null },
) {
  if (!order?._id) {
    return {
      success: false,
      printed: false,
      prepared: false,
      claimLost: false,
      message: "Order not found",
    };
  }

  const shortId = getOrderShortId(order);

  try {
    const updatedOrder = await updateOrderStatus(order._id, "preparing", {
      autoPrintClaim: true,
    });

    if (storeProfile) {
      void printKitchenOrder(updatedOrder, {
        storeProfile,
        itemGroups,
        menuConfig,
        menuContent,
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
      claimLost: false,
      updatedOrder,
      shortId,
      message: `Order #${shortId} sent to kitchen`,
    };
  } catch (error) {
    if (error?.code === "AUTO_PRINT_CLAIM_LOST") {
      const currentOrder = error.order || order;
      reportAutoPrintClaimLost(currentOrder, {
        autoPrintedAt: error.autoPrintedAt || currentOrder?.autoPrintedAt,
        status: error.status || currentOrder?.status,
      });
      console.warn(
        `[auto-print] Claim lost for order ${shortId} — duplicate print suppressed`,
      );
      return {
        success: true,
        printed: false,
        prepared: false,
        claimLost: true,
        updatedOrder: currentOrder,
        shortId,
        message: `Order #${shortId} auto-print already claimed`,
      };
    }

    console.error(
      `[auto-print] Order ${shortId} could not move to Preparing:`,
      error,
    );
    return {
      success: false,
      printed: false,
      prepared: false,
      claimLost: false,
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
