/**
 * Held-check status updates that may include unsynced local ids.
 *
 * Local database mode mirrors live: Cancel / All Served / Complete update
 * local rows and keep them for outbox sync. Cancelled and paid+delivered
 * leave the table map / Held UI, same as Mongo held lifecycle.
 * Mongo ids use the live API.
 */
import { updatePosHeldCheckStatus, markPosBillPrinted } from "@/lib/api/fetchApi";
import { isMongoObjectId } from "@/lib/localDb/localHeldOrders";
import { markLocalOrdersKitchenStatus } from "@/lib/localDb/offlineSendStore";

function splitOrderIds(orderIds) {
  const ids = [
    ...new Set(
      (orderIds || []).map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
  return {
    localIds: ids.filter((id) => !isMongoObjectId(id)),
    mongoIds: ids.filter((id) => isMongoObjectId(id)),
  };
}

/**
 * Cancel or complete held tickets. Local rows stay queued for sync.
 */
export async function updateHeldCheckStatusMixed({
  orderIds,
  status,
  cancelReason,
  requireCancelReason,
}) {
  const { localIds, mongoIds } = splitOrderIds(orderIds);
  if (localIds.length === 0 && mongoIds.length === 0) {
    return { success: false, error: "No tickets to update" };
  }

  if (localIds.length > 0) {
    if (status === "cancelled" || status === "delivered") {
      const localResult = await markLocalOrdersKitchenStatus(
        localIds,
        status,
        {
          cancelReason:
            status === "cancelled" ? cancelReason || "" : undefined,
        },
      );
      if (!localResult?.success) return localResult;
    } else {
      return {
        success: false,
        error: "This local ticket cannot be updated until it syncs",
      };
    }
  }

  if (mongoIds.length === 0) return { success: true };

  return updatePosHeldCheckStatus({
    orderIds: mongoIds,
    status,
    cancelReason,
    requireCancelReason,
  });
}

/** Mark bill printed only for tickets that exist on the server. */
export async function markPosBillPrintedMixed(orderIds) {
  const { mongoIds } = splitOrderIds(orderIds);
  if (mongoIds.length === 0) return { success: true, localOnly: true };
  return markPosBillPrinted(mongoIds);
}
