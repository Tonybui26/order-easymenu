"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/helper";
import SideDrawer from "./SideDrawer";

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatOptionLabel(option) {
  const name = String(option?.optionName || option?.name || "").trim();
  if (!name) return null;
  const price = Number(option?.priceModifier || 0);
  if (price > 0) return `${name} (+${formatMoney(price)})`;
  if (price < 0) return `${name} (${formatMoney(price)})`;
  return name;
}

function PreviewLine({ line }) {
  const qty = Number(line.quantity || 1);
  const unitPrice = Number(line.price || 0);
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;
  const variants = line.selectedVariants || [];
  const modifiers = line.selectedModifiers || [];
  const optionLabels = [...variants, ...modifiers]
    .map(formatOptionLabel)
    .filter(Boolean);

  return (
    <li className="flex gap-2 px-3 py-2.5">
      <span className="w-8 shrink-0 text-sm tabular-nums text-neutral-500">
        {qty}×
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-neutral-900">
            {line.title || "Untitled"}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-neutral-800">
            {formatMoney(lineTotal)}
          </span>
        </div>
        {optionLabels.length > 0 ? (
          <ul className="mt-0.5 space-y-0.5">
            {optionLabels.map((label) => (
              <li key={label} className="text-xs text-neutral-500">
                {label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export default function PosTableMapTableDrawer({
  isOpen,
  onClose,
  tableName,
  heldOrder,
  onLoadOrder,
  onPrintBill,
  isProcessing = false,
  previewLines = [],
  isPreviewLoading = false,
  previewError = null,
}) {
  if (!tableName) return null;

  const ticketCount = heldOrder?.orderIds?.length || 0;
  const subtitleParts = [];
  if (heldOrder?.total != null) {
    subtitleParts.push(formatMoney(heldOrder.total));
  }
  if (ticketCount > 1) {
    subtitleParts.push(`${ticketCount} tickets`);
  }
  if (heldOrder?.allPaid) {
    subtitleParts.push("Paid");
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Table ${tableName}`}
      subtitle={
        subtitleParts.length > 0
          ? subtitleParts.join(" · ")
          : "Open check on this table"
      }
      closeDisabled={isProcessing}
      contentKey={`table-map-drawer-${tableName}`}
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
          <div className="border-b border-neutral-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Order items
          </div>
          {isPreviewLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading items…
            </div>
          ) : previewError ? (
            <p className="px-3 py-4 text-sm text-red-600">{previewError}</p>
          ) : previewLines.length === 0 ? (
            <p className="px-3 py-4 text-sm text-neutral-500">
              No items on this check.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {previewLines.map((line) => (
                <PreviewLine
                  key={line.lineId || `${line.itemId}-${line.title}-${line.quantity}`}
                  line={line}
                />
              ))}
            </ul>
          )}
          {heldOrder?.total != null && !isPreviewLoading && !previewError ? (
            <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/80 px-3 py-2.5">
              <span className="text-sm font-semibold text-neutral-700">
                Total
              </span>
              <span className="text-sm font-bold tabular-nums text-neutral-900">
                {formatMoney(heldOrder.total)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-100 bg-neutral-50/80 p-3">
          <button
            type="button"
            disabled={isProcessing || !heldOrder?.orderIds?.length}
            onClick={onLoadOrder}
            className={cn(
              "rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors",
              isProcessing
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-blue-700 active:bg-blue-800",
            )}
          >
            Load order
          </button>
          <button
            type="button"
            disabled={isProcessing || !heldOrder?.orderIds?.length}
            onClick={onPrintBill}
            className={cn(
              "rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors",
              isProcessing
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-teal-700 active:bg-teal-800",
            )}
          >
            {isProcessing ? "Printing..." : "Print bill"}
          </button>
        </div>
      </div>
    </SideDrawer>
  );
}
