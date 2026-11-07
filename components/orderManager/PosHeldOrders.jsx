"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePosNavigate } from "@/components/context/PosNavigateContext";
import toast from "react-hot-toast";
import {
  completePosSaleBatch,
  fetchPosHeldOrders,
  fetchPosResumeOrders,
  updateOrderStatus,
} from "@/lib/api/fetchApi";
import {
  markPosBillPrintedMixed,
  updateHeldCheckStatusMixed,
} from "@/lib/localDb/localHeldActions";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  printBillForHeldCheck,
  printHeldCheckKitchenOnPrepare,
  reprintHeldCheckKitchen,
} from "@/lib/pos/posHeldOrderPrint";
import { printReceiptForHistoryCheck } from "@/lib/pos/posHistoryOrderPrint";
import {
  buildHeldDrawerPreviewSections,
  buildHeldDrawerSurchargeLines,
} from "@/lib/pos/posHeldDrawerPreview";
import { buildCartLinesFromResumeOrders } from "@/lib/pos/posResumeOrder";
import {
  getAllTicketIds,
  buzzerTakeawayNumber,
  getPosHeldDrawerTitle,
  getTicketIdsNotDelivered,
  getTicketIdsByStatus,
  isBuzzerTakeawayHeldOrder,
  isPosDineInHeldOrder,
  isPickupOrDeliveryHeldOrder,
  isPosSourceHeldOrder,
  isQrHeldAwaitingPaymentToPrepare,
  isUnpaidCounterSelfOrder,
  resolveHeldAggregateStatus,
} from "@/lib/pos/posHeldOrder";
import { isCounterPayment } from "@/lib/helper/payLater";
import { resolvePosConfig } from "@/lib/pos/posConfig";
import {
  isLinklyPosCardReady,
  isTyroPosCardReady,
  resolvePosPaymentsConfig,
} from "@/lib/pos/posPaymentsConfig";
import PosPaymentDrawer from "./PosPaymentDrawer";
import PosChromeHeader from "./PosChromeHeader";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";
import PosHeldOrderCard from "./PosHeldOrderCard";
import SelfOrderingHeldOrderCard from "./SelfOrderingHeldOrderCard";
import PosSelfOrderingHeldDrawer from "./PosSelfOrderingHeldDrawer";
import PosTableMapTableDrawer from "./PosTableMapTableDrawer";
import DeleteOrderDrawer from "./DeleteOrderDrawer";
import { buildHeldCheckCancelTarget } from "@/lib/helper/buildCancelOrderTarget";
import DismissibleToast, {
  useDismissibleToast,
} from "@/components/orderManager/DismissibleToast";
import {
  hydrateHeldOrders,
  hydrateResumeOrders,
} from "@/lib/localDb/posLiveSnapshot";

const HELD_ORDERS_POLL_MS = 10000;

function orderIdsCacheKey(orderIds) {
  return (orderIds || []).map(String).join(",");
}

function ticketsStatusKey(heldOrder) {
  return (heldOrder?.tickets || [])
    .map((ticket) => `${ticket.orderId}:${String(ticket.status || "").trim()}`)
    .join(",");
}

function previewLinesFromResumeOrders(orders) {
  return buildCartLinesFromResumeOrders(orders).filter(
    (line) => String(line.kitchenStatus || "").trim() !== "cancelled",
  );
}

function shouldPrepareOrderAfterPosPay(order) {
  if (!order) return false;
  if (String(order?.source || "").trim() === "pos") return false;
  if (!isCounterPayment(order?.paymentMethod)) return false;
  const status = String(order?.status || "").trim();
  return ["pending", "confirmed", "accepted"].includes(status);
}

/**
 * Held Orders — open checks (POS, QR, and online) until paid and cleared.
 */
export default function PosHeldOrders() {
  const { navigate } = usePosNavigate();
  const {
    toast: dismissibleToast,
    showToast: showDismissibleToast,
    hideToast: hideDismissibleToast,
  } = useDismissibleToast();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer(showDismissibleToast);
  const { storeProfile, itemGroups, menuConfig, menuContent } = useMenuContext();
  const posConfig = useMemo(() => resolvePosConfig(menuConfig), [menuConfig]);
  const isPayFirstMode = Boolean(posConfig.payFirstModeEnabled);
  const tyroPayments = useMemo(
    () => resolvePosPaymentsConfig(menuConfig).tyro,
    [menuConfig],
  );
  const linklyPayments = useMemo(
    () => resolvePosPaymentsConfig(menuConfig).linkly,
    [menuConfig],
  );
  const tyroCardEnabled = isTyroPosCardReady(menuConfig);
  const linklyCardEnabled = isLinklyPosCardReady(menuConfig);
  const [heldOrders, setHeldOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingCheckId, setProcessingCheckId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelDrawerOpen, setCancelDrawerOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [drawerHeldOrder, setDrawerHeldOrder] = useState(null);
  const [tenderHeldOrder, setTenderHeldOrder] = useState(null);
  const [isCompletingSale, setIsCompletingSale] = useState(false);
  const [previewLines, setPreviewLines] = useState([]);
  const [previewSections, setPreviewSections] = useState([]);
  const [previewSurchargeLines, setPreviewSurchargeLines] = useState([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const resumeOrdersCacheRef = useRef(new Map());

  const loadHeldOrders = useCallback(async ({ silent = false, paintLocalFirst = false } = {}) => {
    if (!silent && !paintLocalFirst) setIsLoading(true);

    try {
      const result = await hydrateHeldOrders(() => fetchPosHeldOrders(), {
        paintLocalFirst,
        onHeld: (next) => {
          setHeldOrders(next);
          if (!silent) setIsLoading(false);
        },
      });
      if (!result?.success && !result?.fromCache && !silent) {
        showDismissibleToast(result?.error || "Failed to load held orders");
      }
    } catch (error) {
      if (!silent) {
        showDismissibleToast(error?.message || "Failed to load held orders");
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [showDismissibleToast]);

  useEffect(() => {
    loadHeldOrders({ paintLocalFirst: true });
    const id = setInterval(
      () => loadHeldOrders({ silent: true }),
      HELD_ORDERS_POLL_MS,
    );
    return () => clearInterval(id);
  }, [loadHeldOrders]);

  useEffect(() => {
    const validKeys = new Set(
      (heldOrders || [])
        .map((entry) => orderIdsCacheKey(entry?.orderIds))
        .filter(Boolean),
    );
    for (const key of [...resumeOrdersCacheRef.current.keys()]) {
      if (!validKeys.has(key)) resumeOrdersCacheRef.current.delete(key);
    }
  }, [heldOrders]);

  useEffect(() => {
    if (!drawerHeldOrder) return;

    const latest = heldOrders.find((entry) => entry.id === drawerHeldOrder.id);
    if (!latest) {
      if (!processingCheckId && !isCancelling && !isDeleting) {
        handleCloseHeldDrawer();
      }
      return;
    }

    setDrawerHeldOrder((prev) => {
      if (
        prev &&
        orderIdsCacheKey(prev.orderIds) === orderIdsCacheKey(latest.orderIds) &&
        Number(prev.total) === Number(latest.total) &&
        Number(prev.amountDue) === Number(latest.amountDue) &&
        Boolean(prev.allPaid) === Boolean(latest.allPaid) &&
        ticketsStatusKey(prev) === ticketsStatusKey(latest)
      ) {
        return prev;
      }
      return latest;
    });
  }, [
    heldOrders,
    drawerHeldOrder?.id,
    processingCheckId,
    isCancelling,
    isDeleting,
  ]);

  const drawerOrderIdsKey = orderIdsCacheKey(drawerHeldOrder?.orderIds);
  const isPosHeldDrawer = Boolean(
    drawerHeldOrder && isPosSourceHeldOrder(drawerHeldOrder),
  );
  const isSelfOrderingHeldDrawer = Boolean(
    drawerHeldOrder && !isPosSourceHeldOrder(drawerHeldOrder),
  );

  useEffect(() => {
    if (!drawerHeldOrder || !drawerOrderIdsKey) {
      setPreviewLines([]);
      setPreviewSections([]);
      setPreviewSurchargeLines([]);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    const orderIds = drawerOrderIdsKey.split(",");
    const cached = resumeOrdersCacheRef.current.get(drawerOrderIdsKey);
    const applyPreview = (orders) => {
      if (isPosSourceHeldOrder(drawerHeldOrder)) {
        setPreviewSections(buildHeldDrawerPreviewSections(orders));
        setPreviewSurchargeLines(buildHeldDrawerSurchargeLines(orders));
        setPreviewLines([]);
      } else {
        setPreviewLines(previewLinesFromResumeOrders(orders));
        setPreviewSections([]);
        setPreviewSurchargeLines([]);
      }
      setPreviewError(null);
      setIsPreviewLoading(false);
    };

    if (cached) applyPreview(cached);

    let cancelled = false;
    if (!cached) {
      setIsPreviewLoading(true);
      setPreviewError(null);
    }

    (async () => {
      try {
        const result = await hydrateResumeOrders(
          orderIds,
          (ids) => fetchPosResumeOrders(ids),
          {
            onOrders: (orders) => {
              if (cancelled) return;
              resumeOrdersCacheRef.current.set(drawerOrderIdsKey, orders);
              applyPreview(orders);
            },
          },
        );
        if (cancelled) return;
        if (
          !cached &&
          (!result?.success || !result.orders?.length) &&
          !result?.fromCache
        ) {
          setPreviewLines([]);
          setPreviewSections([]);
          setPreviewSurchargeLines([]);
          setPreviewError(result?.error || "Could not load items");
          setIsPreviewLoading(false);
        }
      } catch (error) {
        if (cancelled || cached) return;
        setPreviewLines([]);
        setPreviewSections([]);
        setPreviewSurchargeLines([]);
        setPreviewError(error?.message || "Could not load items");
        setIsPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [drawerHeldOrder, drawerOrderIdsKey]);

  function clearHeldDrawer() {
    setDrawerHeldOrder(null);
    setPreviewLines([]);
    setPreviewSections([]);
    setPreviewSurchargeLines([]);
    setPreviewError(null);
    setIsPreviewLoading(false);
  }

  function handleCloseHeldDrawer() {
    if (processingCheckId || isCancelling || isDeleting) return;
    clearHeldDrawer();
  }

  function openHeldDrawer(order) {
    const cacheKey = orderIdsCacheKey(order.orderIds);
    const cached = resumeOrdersCacheRef.current.get(cacheKey);
    setDrawerHeldOrder(order);
    setPreviewError(null);

    if (isPosSourceHeldOrder(order)) {
      setPreviewLines([]);
      if (cached) {
        setPreviewSections(buildHeldDrawerPreviewSections(cached));
        setPreviewSurchargeLines(buildHeldDrawerSurchargeLines(cached));
        setIsPreviewLoading(false);
      } else {
        setPreviewSections([]);
        setPreviewSurchargeLines([]);
        setIsPreviewLoading(true);
      }
      return;
    }

    setPreviewSections([]);
    if (cached) {
      setPreviewLines(previewLinesFromResumeOrders(cached));
      setIsPreviewLoading(false);
    } else {
      setPreviewLines([]);
      setIsPreviewLoading(true);
    }
  }

  function handleSelectHeldOrder(order) {
    if (!order?.orderIds?.length) return;
    openHeldDrawer(order);
  }

  function handlePosDrawerLoadOrder() {
    if (!drawerHeldOrder?.orderIds?.length) return;
    navigate(
      `/pos?resume=${encodeURIComponent(drawerHeldOrder.orderIds.join(","))}`,
    );
  }

  function handlePayHeldOrder(order) {
    const target = order?.orderIds?.length ? order : drawerHeldOrder;
    if (!target?.orderIds?.length) return;
    if (target.allPaid) {
      showDismissibleToast("This check is already paid");
      return;
    }
    // QR counter cash/card stays on Held — tender only, no POS menu or invoice.
    if (!isPosSourceHeldOrder(target) && isUnpaidCounterSelfOrder(target)) {
      clearHeldDrawer();
      setTenderHeldOrder(target);
      return;
    }
    navigate(
      `/pos?resume=${encodeURIComponent(target.orderIds.join(","))}&pay=1`,
    );
  }

  async function prepareQrCounterOrdersAfterPay(orders) {
    if (!isPayFirstMode) return;

    const toPrepare = (orders || []).filter(shouldPrepareOrderAfterPosPay);
    if (toPrepare.length === 0) return;

    const preparedIds = [];
    for (const order of toPrepare) {
      try {
        const updated = await updateOrderStatus(order._id, "preparing");
        preparedIds.push(String(updated?._id || order._id));
      } catch (error) {
        console.error(
          `[held pay] Failed to prepare QR order ${order._id}:`,
          error,
        );
      }
    }

    if (preparedIds.length === 0 || !storeProfile) return;

    try {
      await printHeldCheckKitchenOnPrepare(orders, preparedIds, {
        storeProfile,
        itemGroups,
        menuConfig,
        menuContent,
      });
    } catch (error) {
      console.error("[held pay] Kitchen print after QR pay failed:", error);
    }
  }

  async function persistHeldQrSale(paymentSummary) {
    const target = tenderHeldOrder;
    if (!target?.orderIds?.length) {
      return { success: false, error: "No order to pay" };
    }
    if (!paymentSummary?.method) {
      return { success: false, error: "Payment method is required" };
    }

    setIsCompletingSale(true);
    try {
      const result = await completePosSaleBatch({
        orderIds: target.orderIds,
        method: paymentSummary.method,
        amountTendered: Number(paymentSummary.amountTendered || 0),
        changeDue: Number(paymentSummary.change || 0),
        processingFee: Number(paymentSummary.processingFee || 0),
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to complete sale");
        return { success: false };
      }

      await prepareQrCounterOrdersAfterPay(result.orders);
      toast.success("Sale completed");
      await loadHeldOrders({ silent: true });
      return { success: true };
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to complete sale");
      return { success: false };
    } finally {
      setIsCompletingSale(false);
    }
  }

  async function handleHeldQrCompleteSale(paymentSummary) {
    const result = await persistHeldQrSale(paymentSummary);
    if (!result?.success) return;
    setTenderHeldOrder(null);
  }

  function handleHeldQrFinishPaidSale() {
    setTenderHeldOrder(null);
  }

  async function markTicketsDelivered(order, orderIds, successMessage) {
    if (!order?.id || processingCheckId || orderIds.length === 0) return;

    setProcessingCheckId(order.id);
    try {
      const result = await updateHeldCheckStatusMixed({
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

  async function handlePrepareHeldOrder(order) {
    const confirmedIds = getTicketIdsByStatus(order, "confirmed");
    const acceptedIds = getTicketIdsByStatus(order, "accepted");
    const orderIds = [...confirmedIds, ...acceptedIds];
    if (orderIds.length === 0) {
      showDismissibleToast("No tickets to prepare");
      return;
    }

    setProcessingCheckId(order.id);
    try {
      const result = await updateHeldCheckStatusMixed({
        orderIds,
        status: "preparing",
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to start preparation");
        return;
      }

      toast.success("Preparation started");
      await loadHeldOrders({ silent: true });

      void (async () => {
        try {
          let orders = null;
          const resume = await hydrateResumeOrders(
            orderIds,
            (ids) => fetchPosResumeOrders(ids),
            {
              onOrders: (next) => {
                orders = next;
              },
            },
          );
          if (!orders?.length && !resume?.orders?.length) return;

          await printHeldCheckKitchenOnPrepare(
            orders || resume.orders,
            orderIds,
            {
              storeProfile,
              itemGroups,
              menuConfig,
              menuContent,
            },
          );
        } catch (error) {
          console.error("[prepare] Kitchen print failed:", error);
        }
      })();
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to start preparation");
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
      const result = await updateHeldCheckStatusMixed({
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

    let orders = null;
    const result = await hydrateResumeOrders(
      orderIds,
      (ids) => fetchPosResumeOrders(ids),
      {
        onOrders: (next) => {
          orders = next;
        },
      },
    );
    if (!orders?.length) {
      showDismissibleToast(result?.error || "Could not load check");
      return null;
    }

    return orders;
  }

  async function handlePrintBillHeldOrder(heldEntry) {
    if (processingCheckId) return;

    setProcessingCheckId(heldEntry.id);
    try {
      const orders = await loadHeldCheckOrders(heldEntry);
      if (!orders) return;

      const printInvoice = Boolean(heldEntry?.allPaid);
      const result = printInvoice
        ? await printReceiptForHistoryCheck(orders, {
            storeProfile,
            menuConfig,
          })
        : await printBillForHeldCheck(orders, {
            storeProfile,
            menuConfig,
          });

      if (result.success) {
        toast.success(
          result.message || (printInvoice ? "Invoice printed" : "Bill printed"),
        );
        if (printInvoice) return;
        const markResult = await markPosBillPrintedMixed(heldEntry.orderIds || []);
        if (!markResult?.success) {
          showDismissibleToast(
            markResult?.error || "Bill printed, but status was not updated",
          );
        } else {
          await loadHeldOrders({ silent: true });
        }
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
    // Don't hold processingCheckId — kitchen print monitors success/failure
    // itself and should not block other actions while printing.
    if (processingCheckId || !heldEntry?.id) return;

    const toastId = toast.loading("Reprinting order…");
    try {
      const orders = await loadHeldCheckOrders(heldEntry);
      if (!orders) {
        toast.dismiss(toastId);
        return;
      }

      const result = await reprintHeldCheckKitchen(orders, {
        storeProfile,
        itemGroups,
        menuConfig,
        menuContent,
      });

      if (result.success) {
        toast.success(result.message || "Kitchen ticket reprinted", {
          id: toastId,
        });
      } else {
        toast.dismiss(toastId);
        showDismissibleToast(result.message || "Failed to reprint order");
      }
    } catch (error) {
      toast.dismiss(toastId);
      showDismissibleToast(error?.message || "Failed to reprint order");
    }
  }

  function handleDeleteHeldOrder(order) {
    if (!order?.id || processingCheckId || isDeleting) return;

    const ticketIds = getAllTicketIds(order);
    if (ticketIds.length === 0) {
      showDismissibleToast("No tickets on this check");
      return;
    }

    setDeleteTarget(buildHeldCheckCancelTarget(order));
    setDeleteDrawerOpen(true);
  }

  function handleCancelHeldOrder(order) {
    if (!order?.id || processingCheckId || isCancelling) return;

    const ticketIds = getAllTicketIds(order);
    if (ticketIds.length === 0) {
      showDismissibleToast("No tickets on this check");
      return;
    }

    setCancelTarget(buildHeldCheckCancelTarget(order));
    setCancelDrawerOpen(true);
  }

  async function handleConfirmCancelHeldOrder(cancelReason) {
    if (!cancelTarget?.orderIds?.length || isCancelling) return;

    setIsCancelling(true);
    setProcessingCheckId(cancelTarget.id);
    try {
      const result = await updateHeldCheckStatusMixed({
        orderIds: cancelTarget.orderIds,
        status: "cancelled",
        cancelReason,
        requireCancelReason: true,
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to cancel order");
        return;
      }

      toast.success(
        cancelTarget.orderIds.length === 1
          ? "Order cancelled"
          : "Check cancelled",
      );
      setCancelDrawerOpen(false);
      setCancelTarget(null);
      clearHeldDrawer();
      await loadHeldOrders({ silent: true });
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to cancel order");
    } finally {
      setIsCancelling(false);
      setProcessingCheckId(null);
    }
  }

  async function handleConfirmDeleteHeldOrder(cancelReason) {
    if (!deleteTarget?.orderIds?.length || isDeleting) return;

    setIsDeleting(true);
    setProcessingCheckId(deleteTarget.id);
    try {
      const result = await updateHeldCheckStatusMixed({
        orderIds: deleteTarget.orderIds,
        status: "cancelled",
        cancelReason,
        requireCancelReason: true,
      });
      if (!result?.success) {
        showDismissibleToast(result?.error || "Failed to cancel order");
        return;
      }

      toast.success(
        deleteTarget.orderIds.length === 1
          ? "Order cancelled"
          : "Check cancelled",
      );
      setDeleteDrawerOpen(false);
      setDeleteTarget(null);
      clearHeldDrawer();
      await loadHeldOrders({ silent: true });
    } catch (error) {
      showDismissibleToast(error?.message || "Failed to cancel order");
    } finally {
      setIsDeleting(false);
      setProcessingCheckId(null);
    }
  }

  const openCount = heldOrders.length;
  const paymentRequiredOrders = heldOrders.filter(
    isQrHeldAwaitingPaymentToPrepare,
  );
  const otherHeldOrders = heldOrders.filter(
    (order) => !isQrHeldAwaitingPaymentToPrepare(order),
  );

  function renderHeldCard(order) {
    const isPosOrder = isPosSourceHeldOrder(order);
    const HeldCard = isPosOrder ? PosHeldOrderCard : SelfOrderingHeldOrderCard;
    return (
      <li key={order.id} className="min-w-0">
        <HeldCard
          order={order}
          onSelect={handleSelectHeldOrder}
          onPrepare={isPosOrder ? undefined : handlePrepareHeldOrder}
          onReady={handleReadyHeldOrder}
          onPay={handlePayHeldOrder}
          onAllItemsServed={handleAllItemsServedHeldOrder}
          onComplete={handleCompleteHeldOrder}
          onPrintBill={handlePrintBillHeldOrder}
          onReprintOrder={handleReprintHeldOrder}
          onDelete={handleDeleteHeldOrder}
          onCancel={handleCancelHeldOrder}
          isProcessing={processingCheckId === order.id}
        />
      </li>
    );
  }

  const undeliveredTicketCount = getTicketIdsNotDelivered(drawerHeldOrder).length;
  const needsServe =
    Boolean(isPosHeldDrawer) && undeliveredTicketCount > 0;
  const isPickupDrawer =
    Boolean(isPosHeldDrawer) && isPickupOrDeliveryHeldOrder(drawerHeldOrder);
  const pickupAggregate = resolveHeldAggregateStatus(drawerHeldOrder);
  const showPosDrawerAllServed =
    !isPickupDrawer && needsServe && !Boolean(drawerHeldOrder?.allPaid);
  const showPosDrawerComplete = isPickupDrawer
    ? Boolean(drawerHeldOrder?.allPaid) && pickupAggregate === "ready"
    : needsServe && Boolean(drawerHeldOrder?.allPaid);
  const showPosDrawerLoadOrder = Boolean(drawerHeldOrder?.orderIds?.length);
  const showPosDrawerPay =
    Boolean(isPosHeldDrawer) && !Boolean(drawerHeldOrder?.allPaid);
  const posDrawerTitle = isBuzzerTakeawayHeldOrder(drawerHeldOrder)
    ? `Buzzer ${buzzerTakeawayNumber(drawerHeldOrder)}`.trim()
    : getPosHeldDrawerTitle(drawerHeldOrder);
  const posDrawerTotalLabel = isPosDineInHeldOrder(drawerHeldOrder)
    ? "Table total"
    : "Order total";
  const isDrawerProcessing =
    Boolean(drawerHeldOrder) &&
    (processingCheckId === drawerHeldOrder?.id || isDeleting);

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
              <div className="mb-7">
                <h1 className="text-xl font-bold text-neutral-900">
                  Held Orders
                </h1>
                <p className="mt-0.5 text-neutral-500">
                  {openCount} open {openCount === 1 ? "check" : "checks"}
                </p>
              </div>

              <div className="duration-200 animate-in fade-in">
                {heldOrders.length === 0 ? (
                  <div className="flex min-h-[12rem] items-center justify-center px-6 text-center">
                    <div>
                      <p className="text-base font-semibold text-neutral-700">
                        No open checks
                      </p>
                      <p className="mt-1 text-sm text-neutral-400">
                        POS, QR, and online orders will appear here
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {paymentRequiredOrders.length > 0 ? (
                      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {paymentRequiredOrders.map(renderHeldCard)}
                      </ul>
                    ) : null}
                    {otherHeldOrders.length > 0 ? (
                      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {otherHeldOrders.map(renderHeldCard)}
                      </ul>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <DismissibleToast
        toast={dismissibleToast}
        onDismiss={hideDismissibleToast}
      />

      <PosTableMapTableDrawer
        isOpen={isPosHeldDrawer}
        onClose={handleCloseHeldDrawer}
        title={posDrawerTitle}
        heldOrder={drawerHeldOrder}
        onLoadOrder={handlePosDrawerLoadOrder}
        onPay={() => handlePayHeldOrder(drawerHeldOrder)}
        onPrintBill={() => handlePrintBillHeldOrder(drawerHeldOrder)}
        onReprintOrder={() => handleReprintHeldOrder(drawerHeldOrder)}
        onDelete={() => handleDeleteHeldOrder(drawerHeldOrder)}
        onAllServed={() => handleAllItemsServedHeldOrder(drawerHeldOrder)}
        onComplete={() => handleCompleteHeldOrder(drawerHeldOrder)}
        isProcessing={isDrawerProcessing}
        previewSections={previewSections}
        surchargeLines={previewSurchargeLines}
        isPreviewLoading={isPreviewLoading}
        previewError={previewError}
        showAllServed={showPosDrawerAllServed}
        showComplete={showPosDrawerComplete}
        showLoadOrder={showPosDrawerLoadOrder}
        showPay={showPosDrawerPay}
        totalLabel={posDrawerTotalLabel}
        emptySubtitle="Open this held check"
      />

      <PosSelfOrderingHeldDrawer
        isOpen={isSelfOrderingHeldDrawer}
        onClose={handleCloseHeldDrawer}
        heldOrder={drawerHeldOrder}
        onPrepare={handlePrepareHeldOrder}
        onReady={handleReadyHeldOrder}
        onPay={handlePayHeldOrder}
        onComplete={handleCompleteHeldOrder}
        onPrintBill={handlePrintBillHeldOrder}
        onReprintOrder={handleReprintHeldOrder}
        onCancel={handleCancelHeldOrder}
        isProcessing={isDrawerProcessing}
        previewLines={previewLines}
        isPreviewLoading={isPreviewLoading}
        previewError={previewError}
      />

      <PosPaymentDrawer
        isOpen={Boolean(tenderHeldOrder)}
        onClose={() => {
          if (isCompletingSale) return;
          setTenderHeldOrder(null);
        }}
        amountDue={Number(
          tenderHeldOrder?.amountDue ?? tenderHeldOrder?.total ?? 0,
        )}
        onCompleteSale={handleHeldQrCompleteSale}
        onPersistSale={persistHeldQrSale}
        onFinishPaidSale={handleHeldQrFinishPaidSale}
        isCompletingSale={isCompletingSale}
        hideReceiptActions
        tyroCardEnabled={tyroCardEnabled}
        tyroConfig={tyroPayments}
        linklyCardEnabled={linklyCardEnabled}
        linklyConfig={linklyPayments}
        onOpenCashDrawer={handleOpenCashDrawer}
      />

      <DeleteOrderDrawer
        isOpen={cancelDrawerOpen}
        onClose={() => {
          if (isCancelling) return;
          setCancelDrawerOpen(false);
          setCancelTarget(null);
        }}
        target={cancelTarget}
        onConfirm={handleConfirmCancelHeldOrder}
        isProcessing={isCancelling}
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
