"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Loader2,
  MoreHorizontal,
  Printer,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/helper";
import PosActionButton from "./PosActionButton";
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

const TABLE_MORE_ACTIONS = [
  {
    id: "print-bill",
    label: "Print Bill",
    icon: FileText,
    tone: "teal",
  },
  {
    id: "reprint-order",
    label: "Reprint Order",
    icon: Printer,
    tone: "blue",
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    tone: "red",
  },
];

export default function PosTableMapTableDrawer({
  isOpen,
  onClose,
  tableName,
  heldOrder,
  onLoadOrder,
  onPrintBill,
  onReprintOrder,
  onDelete,
  onAllServed,
  onComplete,
  isProcessing = false,
  previewLines = [],
  isPreviewLoading = false,
  previewError = null,
  showAllServed = false,
  showComplete = false,
}) {
  const [showMoreActions, setShowMoreActions] = useState(false);

  useEffect(() => {
    if (!isOpen) setShowMoreActions(false);
  }, [isOpen, tableName]);

  if (!tableName) return null;

  const ticketCount = heldOrder?.orderIds?.length || 0;
  const allPaid = Boolean(heldOrder?.allPaid);
  // Unpaid + track food: Load + All served. Paid + track food: Complete only.
  // Unpaid without serve action: Load + Print bill.
  const showPrintBill = !allPaid && !showAllServed;
  const showLoadOrder = !showComplete;
  const subtitleParts = [];
  if (heldOrder?.total != null) {
    subtitleParts.push(formatMoney(heldOrder.total));
  }
  if (ticketCount > 1) {
    subtitleParts.push(`${ticketCount} tickets`);
  }
  if (allPaid) {
    subtitleParts.push("Paid");
  }

  const hasTickets = Boolean(heldOrder?.orderIds?.length);
  const actionsDisabled = isProcessing || !hasTickets;

  const visibleMoreActions = TABLE_MORE_ACTIONS.filter((action) => {
    // Don't repeat actions already shown as primary footer buttons.
    if (action.id === "print-bill") return !showPrintBill;
    if (action.id === "delete") return !allPaid;
    return true;
  });

  const actionButtons = (
    <div className="">
      <button
        type="button"
        aria-label={`More actions for table ${tableName}`}
        aria-expanded={showMoreActions}
        disabled={actionsDisabled}
        onClick={() => setShowMoreActions((open) => !open)}
        className={cn(
          "absolute left-1/2 top-0 z-30 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition-colors",
          showMoreActions
            ? "border-neutral-300 text-neutral-800"
            : "border-neutral-200/90 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 active:bg-neutral-100",
          actionsDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
      </button>

      <div
        className={cn(
          "grid gap-2",
          showLoadOrder && (showPrintBill || showAllServed)
            ? "grid-cols-2"
            : "grid-cols-1",
        )}
      >
        {showLoadOrder ? (
          <PosActionButton
            tone="blue"
            disabled={actionsDisabled}
            onClick={onLoadOrder}
          >
            Load order
          </PosActionButton>
        ) : null}
        {showPrintBill ? (
          <PosActionButton
            tone="teal"
            icon={FileText}
            disabled={actionsDisabled}
            onClick={onPrintBill}
          >
            {isProcessing ? "Printing..." : "Print Bill"}
          </PosActionButton>
        ) : null}
        {showAllServed ? (
          <PosActionButton
            tone="green"
            disabled={actionsDisabled}
            onClick={onAllServed}
          >
            {isProcessing ? "Updating…" : "All Served"}
          </PosActionButton>
        ) : null}
        {showComplete ? (
          <PosActionButton
            tone="purple"
            disabled={actionsDisabled}
            onClick={onComplete}
          >
            {isProcessing ? "Updating…" : "Complete"}
          </PosActionButton>
        ) : null}
      </div>
    </div>
  );

  const moreActionsPanel = showMoreActions ? (
    <div className="flex flex-col gap-2 p-3 pb-6">
      {visibleMoreActions.map((action) => (
        <PosActionButton
          key={action.id}
          tone={action.tone}
          icon={action.icon}
          disabled={isProcessing}
          onClick={() => {
            setShowMoreActions(false);
            if (action.id === "print-bill") onPrintBill?.();
            if (action.id === "reprint-order") onReprintOrder?.();
            if (action.id === "delete") onDelete?.();
          }}
        >
          {action.label}
        </PosActionButton>
      ))}
    </div>
  ) : null;

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
      footer={actionButtons}
      footerClassName="overflow-visible shadow-[0_-8px_24px_rgba(0,0,0,0.06)]"
      bodyOverlay={showMoreActions}
      onBodyOverlayClick={() => setShowMoreActions(false)}
      bottomSlidePanel={moreActionsPanel}
    >
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
                key={
                  line.lineId || `${line.itemId}-${line.title}-${line.quantity}`
                }
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
    </SideDrawer>
  );
}
