/**
 * Held-check status updates that may include unsynced local ids.
 *
 * Local database mode mirrors live: Cancel / All Served / Complete update
 * local rows and keep them for outbox sync. Cancelled and paid+delivered
 * leave the table map / Held UI, same as Mongo held lifecycle.
 * Mongo ids use the live API.
 */
import { updatePosHeldCheckStatus, markPosBillPrinted, cancelPosOrderItem } from "@/lib/api/fetchApi";
import { isMongoObjectId } from "@/lib/localDb/localHeldOrders";
import {
  cancelLocalPosOrderItem,
  markLocalOrdersKitchenStatus,
} from "@/lib/localDb/offlineSendStore";

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

/**
 * Void a sent POS line. Routes local ids to on-device store; Mongo ids to API.
 * If a local row already has a server id, also voids on the server.
 */
export async function cancelPosOrderItemMixed({ orderId, lineId, reason }) {
  const id = String(orderId || "").trim();
  const targetLineId = String(lineId || "").trim();
  const cancelReason = String(reason || "").trim();

  if (!id || !targetLineId) {
    return { success: false, error: "orderId and lineId are required" };
  }

  if (!isMongoObjectId(id)) {
    const localResult = await cancelLocalPosOrderItem({
      localId: id,
      lineId: targetLineId,
      reason: cancelReason,
    });
    if (!localResult?.success) return localResult;

    const serverOrderId = String(localResult.serverOrderId || "").trim();
    if (isMongoObjectId(serverOrderId)) {
      const remote = await cancelPosOrderItem({
        orderId: serverOrderId,
        lineId: targetLineId,
        reason: cancelReason,
      });
      if (!remote?.success) {
        return {
          success: false,
          error:
            remote?.error ||
            "Voided on device, but server void failed — retry when online",
        };
      }
      return {
        success: true,
        item: remote.item || localResult.item,
        order: remote.order || localResult.order,
      };
    }

    return localResult;
  }

  return cancelPosOrderItem({
    orderId: id,
    lineId: targetLineId,
    reason: cancelReason,
  });
}
