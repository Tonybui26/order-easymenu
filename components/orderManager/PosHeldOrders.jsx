"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  fetchPosHeldOrders,
  fetchPosResumeOrders,
  updatePosHeldCheckStatus,
} from "@/lib/api/fetchApi";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  printBillForHeldCheck,
  reprintHeldCheckKitchen,
} from "@/lib/pos/posHeldOrderPrint";
import {
  getAllTicketIds,
  getTicketIdsNotDelivered,
  getTicketIdsByStatus,
  isPosDineInHeldOrder,
  isPosSourceHeldOrder,
} from "@/lib/pos/posHeldOrder";
import PosChromeHeader from "./PosChromeHeader";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";
import PosHeldOrderCard from "./PosHeldOrderCard";
import SelfOrderingHeldOrderCard from "./SelfOrderingHeldOrderCard";
import DeleteOrderDrawer from "./DeleteOrderDrawer";
import DismissibleToast, {
  useDismissibleToast,
} from "@/components/orderManager/DismissibleToast";

const HELD_ORDERS_POLL_MS = 10000;

const HELD_TABS = [
  { id: "pos", label: "POS" },
  { id: "self-ordering", label: "Self Ordering" },
];

/**
 * Held Orders — open checks (POS + Self Ordering) until paid and cleared.
 */
export default function PosHeldOrders() {
  const router = useRouter();
  const {
    toast: dismissibleToast,
    showToast: showDismissibleToast,
    hideToast: hideDismissibleToast,
  } = useDismissibleToast();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer(showDismissibleToast);
  const { storeProfile, itemGroups, menuConfig } = useMenuContext();
  const [heldOrders, setHeldOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("pos");
  const [isLoading, setIsLoading] = useState(true);
  const [processingCheckId, setProcessingCheckId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadHeldOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);

    try {
      const result = await fetchPosHeldOrders();
      if (!result?.success) {
        if (!silent) {
          showDismissibleToast(result?.error || "Failed to load held orders");
        }
        return;
      }
      setHeldOrders(result.heldOrders || []);
    } catch (error) {
      if (!silent) {
        showDismissibleToast(error?.message || "Failed to load held orders");
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHeldOrders();
    const id = setInterval(
      () => loadHeldOrders({ silent: true }),
      HELD_ORDERS_POLL_MS,
    );
    return () => clearInterval(id);
  }, [loadHeldOrders]);

  const posHeldOrders = useMemo(
    () => heldOrders.filter(isPosSourceHeldOrder),
    [heldOrders],
  );
  const selfOrderingHeldOrders = useMemo(
    () => heldOrders.filter((order) => !isPosSourceHeldOrder(order)),
    [heldOrders],
  );
  const visibleHeldOrders =
    activeTab === "pos" ? posHeldOrders : selfOrderingHeldOrders;

  function handleSelectHeldOrder(order) {
    if (!order?.orderIds?.length) return;
    if (!isPosSourceHeldOrder(order)) {
      showDismissibleToast("Self Ordering checks open on Live Orders");
      return;
    }
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
        showDismissibleToast(result?.error || "Failed to update order");
        return;
      }
      toast.success(successMessage);
      await loadHeldOrders({ silent: true });
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to update order");
    } finally {
      setProcessingCheckId(null);
    }
  }

  async function handleReadyHeldOrder(order) {
    const preparingIds = getTicketIdsByStatus(order, "preparing");
    if (preparingIds.length === 0) {
      showDismissibleToast("No tickets to mark ready");
      return;
    }

    setProcessingCheckId(order.id);
    try {
      const result = await updatePosHeldCheckStatus({
        orderIds: preparingIds,
        status: "ready",
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to mark ready");
        return;
      }
      toast.success("Marked ready");
      await loadHeldOrders({ silent: true });
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to mark ready");
    } finally {
      setProcessingCheckId(null);
    }
  }

  async function handleAllItemsServedHeldOrder(order) {
    const ticketIds = getTicketIdsNotDelivered(order);
    if (ticketIds.length === 0) {
      showDismissibleToast("No tickets to update");
      return;
    }
    await markTicketsDelivered(order, ticketIds, "All Served");
  }

  async function handleCompleteHeldOrder(order) {
    if (!order.allPaid) {
      showDismissibleToast("Pay the check before completing");
      return;
    }

    const ticketIds = isPosDineInHeldOrder(order)
      ? getTicketIdsNotDelivered(order)
      : getAllTicketIds(order);

    if (ticketIds.length === 0) {
      showDismissibleToast("No tickets to complete");
      return;
    }

    await markTicketsDelivered(order, ticketIds, "Order completed");
  }

  async function loadHeldCheckOrders(heldEntry) {
    const orderIds = heldEntry?.orderIds || [];
    if (orderIds.length === 0) {
      showDismissibleToast("No tickets on this check");
      return null;
    }

    const result = await fetchPosResumeOrders(orderIds);
    if (!result?.success || !result.orders?.length) {
      showDismissibleToast(result?.error || "Could not load check");
      return null;
    }

    return result.orders;
  }

  async function handlePrintBillHeldOrder(heldEntry) {
    if (processingCheckId) return;

    setProcessingCheckId(heldEntry.id);
    try {
      const orders = await loadHeldCheckOrders(heldEntry);
      if (!orders) return;

      const result = await printBillForHeldCheck(orders, {
        storeProfile,
        heldEntry,
      });

      if (result.success) {
        toast.success(result.message || "Bill printed");
      } else {
        showDismissibleToast(result.message || "Failed to print bill");
      }
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to print bill");
    } finally {
      setProcessingCheckId(null);
    }
  }

  async function handleReprintHeldOrder(heldEntry) {
    if (processingCheckId) return;

    setProcessingCheckId(heldEntry.id);
    try {
      const orders = await loadHeldCheckOrders(heldEntry);
      if (!orders) return;

      const result = await reprintHeldCheckKitchen(orders, {
        storeProfile,
        itemGroups,
        menuConfig,
        showCustomToast: showDismissibleToast,
      });

      if (result.success) {
        toast.success(result.message || "Kitchen ticket reprinted");
      } else {
        showDismissibleToast(result.message || "Failed to reprint order");
      }
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to reprint order");
    } finally {
      setProcessingCheckId(null);
    }
  }

  function buildHeldDeleteTarget(order) {
    const ticketIds = getAllTicketIds(order);
    const table = String(order?.table || "").trim();
    const taxInvoiceNo = String(order?.taxInvoiceNo || "").trim();
    const title = table
      ? `Delete Table ${table}`
      : taxInvoiceNo
        ? `Delete invoice ${taxInvoiceNo}`
        : "Delete held check";

    const subtitleParts = [];
    if (ticketIds.length > 1) {
      subtitleParts.push(`${ticketIds.length} tickets`);
    }
    if (order?.total != null) {
      subtitleParts.push(`$${Number(order.total).toFixed(2)} unpaid`);
    }

    return {
      id: order.id,
      title,
      subtitle: subtitleParts.join(" · ") || "This will cancel the open check.",
      orderIds: ticketIds,
      ticketCount: ticketIds.length,
    };
  }

  function handleDeleteHeldOrder(order) {
    if (!order?.id || processingCheckId || isDeleting) return;

    if (order.allPaid) {
      showDismissibleToast("Paid checks cannot be deleted");
      return;
    }

    const ticketIds = getAllTicketIds(order);
    if (ticketIds.length === 0) {
      showDismissibleToast("No tickets on this check");
      return;
    }

    setDeleteTarget(buildHeldDeleteTarget(order));
    setDeleteDrawerOpen(true);
  }

  async function handleConfirmDeleteHeldOrder(cancelReason) {
    if (!deleteTarget?.orderIds?.length || isDeleting) return;

    setIsDeleting(true);
    setProcessingCheckId(deleteTarget.id);
    try {
      const result = await updatePosHeldCheckStatus({
        orderIds: deleteTarget.orderIds,
        status: "cancelled",
        cancelReason,
        requireCancelReason: true,
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to delete check");
        return;
      }

      toast.success(
        deleteTarget.orderIds.length === 1
          ? "Held order deleted"
          : "Held check deleted",
      );
      setDeleteDrawerOpen(false);
      setDeleteTarget(null);
      await loadHeldOrders({ silent: true });
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to delete check");
    } finally {
      setIsDeleting(false);
      setProcessingCheckId(null);
    }
  }

  const tabCount =
    activeTab === "pos" ? posHeldOrders.length : selfOrderingHeldOrders.length;

  return (
    <>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f0f0f0] pb-[env(safe-area-inset-bottom)]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-sm text-neutral-500">Loading held orders…</p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-neutral-900">
                    Held Orders
                  </h1>
                  <p className="mt-0.5 text-neutral-500">
                    {tabCount} open {tabCount === 1 ? "check" : "checks"}
                    {activeTab === "self-ordering"
                      ? " · Self Ordering"
                      : " · POS"}
                  </p>
                </div>

                <div className="flex shrink-0 space-x-1 rounded-xl bg-white p-1 shadow-sm">
                  {HELD_TABS.map((tab) => {
                    const count =
                      tab.id === "pos"
                        ? posHeldOrders.length
                        : selfOrderingHeldOrders.length;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`rounded-lg px-4 py-2.5 text-base font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-brand_accent text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                        }`}
                      >
                        {tab.label}
                        <span
                          className={`ml-1.5 tabular-nums ${
                            isActive ? "text-white/80" : "text-gray-400"
                          }`}
                        >
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="duration-200 animate-in fade-in">
                {visibleHeldOrders.length === 0 ? (
                  <div className="flex min-h-[12rem] items-center justify-center px-6 text-center">
                    <div>
                      <p className="text-base font-semibold text-neutral-700">
                        {activeTab === "pos"
                          ? "No POS checks"
                          : "No Self Ordering checks"}
                      </p>
                      <p className="mt-1 text-sm text-neutral-400">
                        {activeTab === "pos"
                          ? "Open POS tickets will appear here"
                          : "Open QR and online orders will appear here"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {visibleHeldOrders.map((order) => {
                      const HeldCard =
                        activeTab === "pos"
                          ? PosHeldOrderCard
                          : SelfOrderingHeldOrderCard;
                      return (
                        <li key={order.id} className="min-w-0">
                          <HeldCard
                            order={order}
                            onSelect={handleSelectHeldOrder}
                            onReady={handleReadyHeldOrder}
                            onAllItemsServed={handleAllItemsServedHeldOrder}
                            onComplete={handleCompleteHeldOrder}
                            onPrintBill={handlePrintBillHeldOrder}
                            onReprintOrder={handleReprintHeldOrder}
                            onDelete={handleDeleteHeldOrder}
                            isProcessing={processingCheckId === order.id}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <DismissibleToast
        toast={dismissibleToast}
        onDismiss={hideDismissibleToast}
        className="right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
      />

      <DeleteOrderDrawer
        isOpen={deleteDrawerOpen}
        onClose={() => {
          if (isDeleting) return;
          setDeleteDrawerOpen(false);
          setDeleteTarget(null);
        }}
        target={deleteTarget}
        onConfirm={handleConfirmDeleteHeldOrder}
        isProcessing={isDeleting}
      />
    </>
  );
}
