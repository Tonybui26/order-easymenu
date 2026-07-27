"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  fetchPosHeldOrders,
  updatePosHeldCheckStatus,
} from "@/lib/api/fetchApi";
import {
  getAllTicketIds,
  getTicketIdsNotDelivered,
  getTicketIdsByStatus,
  isPosDineInHeldOrder,
} from "@/lib/pos/posHeldOrder";
import PosChromeHeader from "./PosChromeHeader";
import PosHeldOrderCard from "./PosHeldOrderCard";

const HELD_ORDERS_POLL_MS = 10000;

/**
 * Held Orders — open POS checks until paid and cleared from Held.
 */
export default function PosHeldOrders() {
  const router = useRouter();
  const [heldOrders, setHeldOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingCheckId, setProcessingCheckId] = useState(null);

  const loadHeldOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);

    try {
      const result = await fetchPosHeldOrders();
      if (!result?.success) {
        if (!silent) {
          toast.error(result?.error || "Failed to load held orders");
        }
        return;
      }
      setHeldOrders(result.heldOrders || []);
    } catch (error) {
      if (!silent) {
        toast.error(error?.message || "Failed to load held orders");
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHeldOrders();
    const id = setInterval(() => loadHeldOrders({ silent: true }), HELD_ORDERS_POLL_MS);
    return () => clearInterval(id);
  }, [loadHeldOrders]);

  function handleSelectHeldOrder(order) {
    if (!order?.orderIds?.length) return;
    router.push(`/pos?resume=${encodeURIComponent(order.orderIds.join(","))}`);
  }

  async function markTicketsDelivered(order, orderIds, successMessage) {
    if (!order?.id || processingCheckId || orderIds.length === 0) return;

    setProcessingCheckId(order.id);
    try {
      const result = await updatePosHeldCheckStatus({
        orderIds,
        status: "delivered",
      });
      if (!result?.success) {
        toast.error(result?.error || "Failed to update order");
        return;
      }
      toast.success(successMessage);
      await loadHeldOrders({ silent: true });
    } catch (error) {
      toast.error(error?.message || "Failed to update order");
    } finally {
      setProcessingCheckId(null);
    }
  }

  async function handleReadyHeldOrder(order) {
    const preparingIds = getTicketIdsByStatus(order, "preparing");
    if (preparingIds.length === 0) {
      toast.error("No tickets to mark ready");
      return;
    }

    setProcessingCheckId(order.id);
    try {
      const result = await updatePosHeldCheckStatus({
        orderIds: preparingIds,
        status: "ready",
      });
      if (!result?.success) {
        toast.error(result?.error || "Failed to mark ready");
        return;
      }
      toast.success("Marked ready");
      await loadHeldOrders({ silent: true });
    } catch (error) {
      toast.error(error?.message || "Failed to mark ready");
    } finally {
      setProcessingCheckId(null);
    }
  }

  async function handleAllItemsServedHeldOrder(order) {
    const ticketIds = getTicketIdsNotDelivered(order);
    if (ticketIds.length === 0) {
      toast.error("No tickets to update");
      return;
    }
    await markTicketsDelivered(order, ticketIds, "All Served");
  }

  async function handleCompleteHeldOrder(order) {
    if (!order.allPaid) {
      toast.error("Pay the check before completing");
      return;
    }

    const ticketIds = isPosDineInHeldOrder(order)
      ? getTicketIdsNotDelivered(order)
      : getAllTicketIds(order);

    if (ticketIds.length === 0) {
      toast.error("No tickets to complete");
      return;
    }

    await markTicketsDelivered(order, ticketIds, "Order completed");
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader />

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f0f0f0] pb-[env(safe-area-inset-bottom)]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-neutral-500">Loading held orders…</p>
          </div>
        ) : heldOrders.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <p className="text-lg font-semibold text-neutral-700">
                Held Orders
              </p>
              <p className="mt-2 text-sm text-neutral-400">
                No open orders on hold
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">
                  Held Orders
                </h1>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {heldOrders.length} open {heldOrders.length === 1 ? "check" : "checks"}
                </p>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {heldOrders.map((order) => (
                <li key={order.id}>
                  <PosHeldOrderCard
                    order={order}
                    onSelect={handleSelectHeldOrder}
                    onReady={handleReadyHeldOrder}
                    onAllItemsServed={handleAllItemsServedHeldOrder}
                    onComplete={handleCompleteHeldOrder}
                    isProcessing={processingCheckId === order.id}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
