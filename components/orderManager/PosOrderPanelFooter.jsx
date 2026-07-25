"use client";

import { Folder, Send, Tag, X } from "lucide-react";
import { cn } from "@/lib/helper";

const GST_RATE = 10;

/**
 * Tax/GST dollar amount embedded in tax-inclusive prices.
 * inclusiveTotal × (rate / (100 + rate))
 */
function computeIncludedTax(inclusiveTotal, taxPercentage = GST_RATE) {
  const total = Number(inclusiveTotal);
  const rate = Number(taxPercentage);
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(((total * rate) / (100 + rate)) * 100) / 100;
}

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

/**
 * Fixed footer for the POS order panel: totals + Clear / Hold|Send / Discount.
 * Middle action becomes Send when the order has items.
 */
export default function PosOrderPanelFooter({
  subtotal = 0,
  discountAmount = null,
  taxPercentage = GST_RATE,
  hasItems = false,
  onClear,
  onHold,
  onSend,
  onDiscount,
  className,
}) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const discount =
    discountAmount == null || Number(discountAmount) <= 0
      ? null
      : Number(discountAmount);
  const total = Math.max(0, safeSubtotal - (discount || 0));
  const taxAmount = computeIncludedTax(total, taxPercentage);
  const showSend = Boolean(hasItems);

  return (
    <div
      className={cn("shrink-0 border-t border-neutral-300 bg-white", className)}
    >
      <div className="grid grid-cols-[1.15fr_1fr] border-b border-neutral-300">
        <div className="space-y-1 border-r border-neutral-300 px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-neutral-500 xl:text-base">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-neutral-400">Discount</span>
            <span className="tabular-nums text-neutral-600">
              {discount == null ? "-" : `-${formatMoney(discount)}`}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-neutral-400">Subtotal</span>
            <span className="tabular-nums text-neutral-600">
              {formatMoney(safeSubtotal)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-neutral-400">Tax (GST)</span>
            <span className="tabular-nums text-neutral-600">
              {formatMoney(taxAmount)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-3 py-2.5 text-center">
          <span className="text-base font-bold uppercase tracking-wide text-neutral-900">
            Total
          </span>
          <span className="text-2xl font-bold text-[#e72a2a]">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 bg-[#f3f3f3]">
        <FooterAction
          icon={X}
          label="Clear"
          onClick={onClear}
          className="border-r border-neutral-300"
        />
        <FooterAction
          icon={showSend ? Send : Folder}
          label={showSend ? "Send" : "Hold"}
          onClick={showSend ? onSend : onHold}
          className="border-r border-neutral-300"
        />
        <FooterAction icon={Tag} label="Discount" onClick={onDiscount} />
      </div>
    </div>
  );
}

function FooterAction({ icon: Icon, label, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[4.25rem] items-center justify-center gap-1.5 px-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 transition-colors hover:bg-neutral-200/80 active:bg-neutral-300/70",
        className,
      )}
    >
      <Icon size={16} strokeWidth={2.25} className="shrink-0" />
      {label}
    </button>
  );
}
