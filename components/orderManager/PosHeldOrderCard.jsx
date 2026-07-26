"use client";

import { useEffect, useState } from "react";
import { Clock3, User } from "lucide-react";
import { cn } from "@/lib/helper";

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
  if (type === "dine-in") {
    return order?.table ? `Table: ${order.table}` : "Dine-in";
  }
  if (type === "pick-up") return "Takeaway";
  if (type === "delivery") return "Delivery";
  if (order?.table) return `Table: ${order.table}`;
  return "Order";
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

/**
 * Minimal held-order card: live hold timer, number, total, placed time, type, customer.
 */
export default function PosHeldOrderCard({ order, onSelect, className }) {
  const heldAt = order?.heldAt || order?.createdAt;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const heldMs = heldAt ? now - new Date(heldAt).getTime() : 0;
  const holdLabel = formatHoldDuration(
    Number.isFinite(heldMs) ? heldMs : 0,
  );
  const isLongHold = heldMs >= 15 * 60 * 1000;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(order)}
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.06)] transition-transform active:scale-[0.99] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.06)]",
        className,
      )}
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
        <span className="text-xl font-bold tabular-nums text-neutral-900">
          {formatMoney(order?.total)}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-bold tracking-tight text-neutral-900">
          {orderNumberLabel(order)}
        </span>
        <span className="text-sm font-medium text-neutral-500">
          {orderTypeLabel(order)}
        </span>
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
  );
}
