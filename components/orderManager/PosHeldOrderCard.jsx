"use client";

import { useEffect, useState } from "react";
import { Clock3, User } from "lucide-react";
import { cn } from "@/lib/helper";
import {
  getHeldAggregateStatusLabel,
  getPosHeldCardActions,
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

function aggregateStatusLabel(heldOrder, status) {
  return getHeldAggregateStatusLabel(heldOrder, status);
}

/**
 * Held-order card with kitchen status and Ready/Complete actions.
 */
export default function PosHeldOrderCard({
  order,
  onSelect,
  onReady,
  onAllItemsServed,
  onComplete,
  isProcessing = false,
  className,
}) {
  const heldAt = order?.heldAt || order?.createdAt;
  const [now, setNow] = useState(() => Date.now());
  const {
    showStatus,
    showReady,
    showAllItemsServed,
    showComplete,
    aggregateStatus,
    completeLabel,
    allItemsServedLabel,
  } = getPosHeldCardActions(order);
  const hasActions = showReady || showAllItemsServed || showComplete;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const heldMs = heldAt ? now - new Date(heldAt).getTime() : 0;
  const holdLabel = formatHoldDuration(Number.isFinite(heldMs) ? heldMs : 0);
  const isLongHold = heldMs >= 15 * 60 * 1000;

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSelect?.(order)}
        className="flex w-full flex-col gap-3 p-4 text-left transition-transform hover:bg-neutral-50/80 active:scale-[0.99]"
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
                isLongHold ? "bg-amber-500" : "animate-pulse bg-emerald-500",
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
                  aggregateStatus === "ready" || aggregateStatus === "delivered"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800",
                )}
              >
                {aggregateStatusLabel(order, aggregateStatus)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-sm text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={14} strokeWidth={2} className="shrink-0 opacity-70" />
            <span className="tabular-nums">
              {formatOrderClock(order?.createdAt || heldAt)}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <User size={14} strokeWidth={2} className="shrink-0 opacity-70" />
            <span className="truncate font-medium text-neutral-700">
              {customerLabel(order)}
            </span>
          </span>
        </div>
      </button>

      {hasActions ? (
        <div className="grid grid-cols-1 gap-2 border-t border-neutral-100 bg-neutral-50/80 p-3">
          {showAllItemsServed ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={(event) => {
                event.stopPropagation();
                onAllItemsServed?.(order);
              }}
              className={cn(
                "rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold tracking-wide text-white transition-colors",
                isProcessing
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-green-700 active:bg-green-800",
              )}
            >
              {isProcessing ? "Updating…" : allItemsServedLabel || "All Served"}
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
    </div>
  );
}
