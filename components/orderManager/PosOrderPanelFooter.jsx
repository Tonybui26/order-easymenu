"use client";

import { Folder, Percent, SquareX, Printer } from "lucide-react";
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
 * Middle action is Send when there are cart lines not yet sent to kitchen.
 */
export default function PosOrderPanelFooter({
  subtotal = 0,
  discountAmount = null,
  taxPercentage = GST_RATE,
  hasUnsentItems = false,
  viewOnly = false,
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
  const showSend = Boolean(hasUnsentItems) && !viewOnly;

  return (
    <div
      className={cn(
        "shrink-0 border-neutral-100 bg-[#f2f2f2] p-2 pt-1",
        className,
      )}
    >
      <div className="overflow-hidden rounded-xl border-[#efefef] bg-white drop-shadow-md">
        <div className="grid grid-cols-[1.15fr_1fr] border-b border-neutral-100">
          <div className="space-y-1 border-r border-[#f2f2f2] px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-neutral-500 xl:text-base">
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

        <div className="flex bg-[#f8f9fb]">
          <FooterAction
            icon={SquareX}
            label=""
            onClick={onClear}
            disabled={viewOnly}
            className="border-neutral-[#e1e1e1] border-r px-6"
          />
          <FooterAction
            icon={showSend ? Printer : Folder}
            label={showSend ? "Send" : "Hold"}
            onClick={showSend ? onSend : onHold}
            disabled={!showSend && !viewOnly && !onHold}
            className="border-neutral-[#e1e1e1] flex-1 border-r"
          />
          <FooterAction
            icon={Percent}
            label="Discount"
            onClick={onDiscount}
            disabled={viewOnly}
          />
        </div>
      </div>
    </div>
  );
}

function FooterAction({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[4.25rem] items-center justify-center gap-2 px-2 text-sm font-semibold uppercase tracking-wide text-neutral-900 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "hover:bg-neutral-200/80 active:bg-neutral-300/70",
        className,
      )}
    >
      <Icon size={22} strokeWidth={1.5} className="shrink-0" />
      {label}
    </button>
  );
}
