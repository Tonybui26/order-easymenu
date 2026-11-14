import { logPrintError, updateOrderStatus } from "@/lib/api/fetchApi";
import { isCounterPayment } from "@/lib/helper/payLater";
import { getPlatform, isNativeApp } from "@/lib/helper/platformDetection";
import { printKitchenOrder } from "@/lib/helper/printKitchenOrder";
import { getAutoPrintingEnabled } from "@/lib/utils/autoPrinting";
import { getMasterDeviceEnabled } from "@/lib/utils/masterDevice";

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

function buildAutoPrintClaimLostDetails(
  order,
  { autoPrintedAt = null, status = null, claimHost = null } = {},
) {
  const claimedAt = autoPrintedAt ? new Date(autoPrintedAt) : null;
  const claimedAtMs = claimedAt && !Number.isNaN(claimedAt.getTime())
    ? claimedAt.getTime()
    : null;
  const nowMs = Date.now();
  const pathname =
    typeof window !== "undefined" ? window.location?.pathname || "" : "";

  return {
    claimHost: claimHost || undefined,
    pathname: pathname || undefined,
    isCustomerDisplayPath: pathname === "/customer-display",
    visibilityState:
      typeof document !== "undefined" ? document.visibilityState : undefined,
    documentHidden:
      typeof document !== "undefined" ? Boolean(document.hidden) : undefined,
    isNative: isNativeApp(),
    platform: getPlatform(),
    autoPrintingEnabled: getAutoPrintingEnabled(),
    masterDeviceEnabled: getMasterDeviceEnabled(),
    orderStatus: status || order?.status || undefined,
    orderSource: order?.source || undefined,
    paymentStatus: order?.paymentStatus || undefined,
    paymentMethod: order?.paymentMethod || undefined,
    orderType: order?.orderType || undefined,
    table: order?.table || undefined,
    autoPrintedAt: claimedAtMs ? claimedAt.toISOString() : undefined,
    claimGapMs:
      claimedAtMs != null ? Math.max(0, nowMs - claimedAtMs) : undefined,
    loggedAt: new Date(nowMs).toISOString(),
  };
}

/**
 * Log a suppressed duplicate auto-print (lost server claim) for later diagnosis.
 * Does not print; appears in power-admin printing logs as source auto_print_claim_lost.
 */
function reportAutoPrintClaimLost(
  order,
  { autoPrintedAt = null, status = null, claimHost = null } = {},
) {
  const orderId = order?._id ? String(order._id) : "";
  if (!orderId) return;

  const shortId = orderId.slice(-6);
  const details = buildAutoPrintClaimLostDetails(order, {
    autoPrintedAt,
    status,
    claimHost,
  });

  const summaryParts = [
    "Auto-print claim lost (duplicate suppressed).",
    details.claimHost ? `host=${details.claimHost}` : null,
    details.pathname ? `path=${details.pathname}` : null,
    details.claimGapMs != null ? `gapMs=${details.claimGapMs}` : null,
    details.orderStatus ? `status=${details.orderStatus}` : null,
    details.orderSource ? `source=${details.orderSource}` : null,
    details.visibilityState ? `visibility=${details.visibilityState}` : null,
  ].filter(Boolean);

  logPrintError({
    type: "print_error",
    orderId,
    orderShortId: shortId,
    message: summaryParts.join(" "),
    failedPrinters: [],
    successfulPrints: 0,
    failedPrints: 0,
    totalPrinters: 0,
    attempt: "final",
    source: "auto_print_claim_lost",
    platform: getPlatform(),
    details,
  }).catch(() => {});
}

/**
 * Auto-print path for paid QR/online orders: atomic server claim → preparing,
 * then kitchen-print in the background. A lost claim skips printing and logs
 * `auto_print_claim_lost` so duplicates can still be investigated.
 *
 * @param {object} order
 * @param {object} options
 * @param {string} [options.claimHost] - Which OM surface attempted auto-print
 *   (`self_order_alerts` | `live_order_terminal`) for claim-lost diagnosis.
 */
export async function autoPrintAndPrepareOrder(
  order,
  {
    storeProfile,
    menuConfig,
    itemGroups,
    menuContent,
    showCustomToast = null,
    claimHost = null,
  },
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
        claimHost,
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
