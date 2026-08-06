"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock3,
  FileText,
  MoreHorizontal,
  Printer,
  Trash2,
  User,
} from "lucide-react";
import { cn } from "@/lib/helper";
import {
  getSelfOrderingHeldCardActions,
  getSelfOrderingHeldStatusLabel,
  isPosDineInHeldOrder,
} from "@/lib/pos/posHeldOrder";

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatOrderClock(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Elapsed hold time as H:MM:SS or M:SS with leading zeros on minutes/seconds. */
function formatHoldDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function orderTypeLabel(order) {
  const type = String(order?.orderType || "").trim();
  if (type === "pick-up") return "Takeaway";
  if (type === "delivery") return "Delivery";
  if (type === "dine-in") return "Dine-in";
  if (order?.table) return `Table: ${order.table}`;
  return "Order";
}

function heldCardPrimaryLabel(order) {
  if (isPosDineInHeldOrder(order)) {
    const table = String(order?.table || "").trim();
    return table ? `Table ${table}` : "Dine-in";
  }
  return orderNumberLabel(order);
}

function heldCardSecondaryLabel(order) {
  if (!isPosDineInHeldOrder(order)) return null;

  const orderIds = Array.isArray(order?.orderIds) ? order.orderIds : [];
  if (orderIds.length <= 1) return null;

  return `${orderIds.length} tickets`;
}

function heldCardTypeLabel(order) {
  if (isPosDineInHeldOrder(order)) return "Dine-in";
  return orderTypeLabel(order);
}

function customerLabel(order) {
  const name = String(order?.customerName || "").trim();
  return name || "N/A";
}

function formatOrderIdLabel(orderId) {
  const id = String(orderId ?? "").trim();
  if (!id) return null;
  return `#${id.slice(-6).toUpperCase()}`;
}

function orderNumberLabel(order) {
  const orderIds = Array.isArray(order?.orderIds) ? order.orderIds : null;
  if (orderIds?.length) {
    if (orderIds.length === 1) {
      return formatOrderIdLabel(orderIds[0]) || "#—";
    }
    const labels = orderIds
      .slice(0, 2)
      .map((id) => formatOrderIdLabel(id))
      .filter(Boolean);
    if (orderIds.length > 2) {
      return `${labels.join(", ")} +${orderIds.length - 2}`;
    }
    return labels.join(", ");
  }

  if (order?.orderNumber != null && order.orderNumber !== "") {
    return `#${order.orderNumber}`;
  }
  if (order?._id || order?.id) {
    return formatOrderIdLabel(order._id || order.id) || "#—";
  }
  return "#—";
}


const HELD_MORE_ACTIONS = [
  {
    id: "print-bill",
    label: "Print Bill",
    icon: FileText,
    className: "bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white",
  },
  {
    id: "reprint-order",
    label: "Reprint Order",
    icon: Printer,
    className: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    className: "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white",
  },
];

/**
 * Held-order card for Self Ordering (QR / online) checks.
 * Status and actions follow Live Order Terminal (non-counter online flow).
 */
export default function SelfOrderingHeldOrderCard({
  order,
  onSelect,
  onPrepare,
  onReady,
  onComplete,
  onPrintBill,
  onReprintOrder,
  onDelete,
  isProcessing = false,
  className,
}) {
  const heldAt = order?.heldAt || order?.createdAt;
  const [now, setNow] = useState(() => Date.now());
  const [showMoreActions, setShowMoreActions] = useState(false);
  const {
    showStatus,
    showPrepare,
    showReady,
    showComplete,
    primaryStatus,
    completeLabel,
  } = getSelfOrderingHeldCardActions(order);
  const hasActions = showPrepare || showReady || showComplete;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const heldMs = heldAt ? now - new Date(heldAt).getTime() : 0;
  const holdLabel = formatHoldDuration(Number.isFinite(heldMs) ? heldMs : 0);
  const isLongHold = heldMs >= 15 * 60 * 1000;
  const visibleMoreActions = HELD_MORE_ACTIONS.filter((action) => {
    if (action.id === "delete") return !order?.allPaid;
    return true;
  });

  return (
    <div
      className={cn(
        "relative flex w-full flex-col rounded-2xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Actions for ${heldCardPrimaryLabel(order)}`}
        aria-expanded={showMoreActions}
        onClick={(event) => {
          event.stopPropagation();
          setShowMoreActions((open) => !open);
        }}
        className={cn(
          "absolute left-1/2 top-0 z-30 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition-colors",
          showMoreActions
            ? "border-neutral-300 text-neutral-800"
            : "border-neutral-200/90 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 active:bg-neutral-100",
        )}
      >
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
      </button>

      <div className="relative overflow-hidden rounded-2xl">
        <motion.div
          animate={{
            opacity: showMoreActions ? 0.35 : 1,
            scale: showMoreActions ? 0.98 : 1,
          }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={cn(showMoreActions && "pointer-events-none")}
        >
          <div
            role="button"
            tabIndex={showMoreActions ? -1 : 0}
            aria-label={`Open ${heldCardPrimaryLabel(order)}`}
            aria-hidden={showMoreActions}
            onClick={() => {
              if (showMoreActions) {
                setShowMoreActions(false);
                return;
              }
              onSelect?.(order);
            }}
            onKeyDown={(event) => {
              if (showMoreActions) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.(order);
              }
            }}
            className="flex w-full cursor-pointer flex-col gap-3 p-4 text-left transition-colors hover:bg-neutral-50/80 active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-base font-semibold tabular-nums tracking-tight",
                  isLongHold
                    ? "bg-amber-50 text-amber-800"
                    : "bg-neutral-100 text-neutral-800",
                )}
                aria-label={`Held for ${holdLabel}`}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    isLongHold
                      ? "bg-amber-500"
                      : "animate-pulse bg-emerald-500",
                  )}
                  aria-hidden
                />
                {holdLabel}
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xl font-bold tabular-nums text-neutral-900">
                  {formatMoney(order?.total)}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    order?.allPaid ? "text-emerald-600" : "text-amber-700",
                  )}
                >
                  {order?.allPaid ? "Paid" : "Unpaid"}
                </span>
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <span
                  className={cn(
                    "block text-xl font-bold tracking-tight text-neutral-900",
                  )}
                >
                  {heldCardPrimaryLabel(order)}
                </span>
                {heldCardSecondaryLabel(order) ? (
                  <span className="mt-0.5 block text-sm font-medium text-neutral-500">
                    {heldCardSecondaryLabel(order)}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-sm font-medium text-neutral-500">
                  {heldCardTypeLabel(order)}
                </span>
                {showStatus ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                      primaryStatus === "ready" ||
                        primaryStatus === "delivered"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800",
                    )}
                  >
                    {getSelfOrderingHeldStatusLabel(primaryStatus)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-sm text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock3
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 opacity-70"
                />
                <span className="tabular-nums">
                  {formatOrderClock(order?.createdAt || heldAt)}
                </span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <User
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 opacity-70"
                />
                <span className="truncate font-medium text-neutral-700">
                  {customerLabel(order)}
                </span>
              </span>
            </div>
          </div>

          {hasActions ? (
            <div className="grid grid-cols-1 gap-2 border-t border-neutral-100 bg-neutral-50/80 p-3">
              {showPrepare ? (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPrepare?.(order);
                  }}
                  className={cn(
                    "rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors",
                    isProcessing
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-blue-700 active:bg-blue-800",
                  )}
                >
                  {isProcessing ? "Updating…" : "Prepare"}
                </button>
              ) : null}
              {showReady ? (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReady?.(order);
                  }}
                  className={cn(
                    "rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors",
                    isProcessing
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-green-700 active:bg-green-800",
                  )}
                >
                  {isProcessing ? "Updating…" : "Ready"}
                </button>
              ) : null}
              {showComplete ? (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={(event) => {
                    event.stopPropagation();
                    onComplete?.(order);
                  }}
                  className={cn(
                    "rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors",
                    isProcessing
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-purple-700 active:bg-purple-800",
                  )}
                >
                  {isProcessing ? "Updating…" : completeLabel || "Complete"}
                </button>
              ) : null}
            </div>
          ) : null}
        </motion.div>

        <AnimatePresence>
          {showMoreActions ? (
            <motion.div
              key="self-ordering-held-more-actions"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 rounded-b-2xl border-t border-neutral-100 bg-white p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
            >
              {visibleMoreActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={
                      isProcessing &&
                      (action.id === "print-bill" ||
                        action.id === "reprint-order" ||
                        action.id === "delete")
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowMoreActions(false);
                      if (action.id === "print-bill") onPrintBill?.(order);
                      if (action.id === "reprint-order")
                        onReprintOrder?.(order);
                      if (action.id === "delete") onDelete?.(order);
                    }}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold tracking-wide transition-colors",
                      action.className,
                      isProcessing &&
                        (action.id === "print-bill" ||
                          action.id === "reprint-order" ||
                          action.id === "delete") &&
                        "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Icon size={16} strokeWidth={2} aria-hidden />
                    {action.label}
                  </button>
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
