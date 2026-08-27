"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CircleDollarSign,
  FileText,
  FolderOpen,
  Loader2,
  Printer,
  Trash2,
  X,
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
  onPay,
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
  // Keep last open snapshot so SideDrawer can play its exit animation after
  // the parent clears tableName / heldOrder on close.
  const openSnapshotRef = useRef(null);

  if (isOpen && tableName) {
    openSnapshotRef.current = {
      tableName,
      heldOrder,
      previewLines,
      isPreviewLoading,
      previewError,
      showAllServed,
      showComplete,
    };
  }

  useEffect(() => {
    if (!isOpen) setShowMoreActions(false);
  }, [isOpen, tableName]);

  const snap = openSnapshotRef.current;
  if (!snap?.tableName) return null;

  const heldTables = Array.isArray(snap.heldOrder?.tables)
    ? snap.heldOrder.tables.filter(Boolean)
    : [];
  const displayTableName =
    heldTables.length > 1 ? heldTables.join(", ") : snap.tableName;
  const displayHeldOrder = snap.heldOrder;
  const displayPreviewLines = snap.previewLines || [];
  const displayPreviewLoading = Boolean(snap.isPreviewLoading);
  const displayPreviewError = snap.previewError;
  const displayShowAllServed = Boolean(snap.showAllServed);
  const displayShowComplete = Boolean(snap.showComplete);

  const ticketCount = displayHeldOrder?.orderIds?.length || 0;
  const allPaid = Boolean(displayHeldOrder?.allPaid);
  // Unpaid + track food: Open + All served. Paid + track food: Complete only.
  // Unpaid without serve action: Open + Pay (Print Bill lives under More).
  const showPay = !allPaid && !displayShowAllServed;
  const showLoadOrder = !displayShowComplete;
  const subtitleParts = [];
  if (displayHeldOrder?.total != null) {
    subtitleParts.push(formatMoney(displayHeldOrder.total));
  }
  if (ticketCount > 1) {
    subtitleParts.push(`${ticketCount} tickets`);
  }
  if (allPaid) {
    subtitleParts.push("Paid");
  }

  const hasTickets = Boolean(displayHeldOrder?.orderIds?.length);
  const actionsDisabled = isProcessing || !hasTickets;

  const visibleMoreActions = TABLE_MORE_ACTIONS.filter((action) => {
    if (action.id === "delete") return !allPaid;
    return true;
  });

  const actionButtons = (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "grid gap-2",
          showLoadOrder && (showPay || displayShowAllServed)
            ? "grid-cols-2"
            : "grid-cols-1",
        )}
      >
        {showLoadOrder ? (
          <PosActionButton
            tone="blue"
            icon={FolderOpen}
            disabled={actionsDisabled}
            onClick={onLoadOrder}
          >
            Open
          </PosActionButton>
        ) : null}
        {showPay ? (
          <PosActionButton
            tone="red"
            icon={CircleDollarSign}
            disabled={actionsDisabled}
            onClick={onPay}
          >
            Pay
          </PosActionButton>
        ) : null}
        {displayShowAllServed ? (
          <PosActionButton
            tone="green"
            disabled={actionsDisabled}
            onClick={onAllServed}
          >
            {isProcessing ? "Updating…" : "All Served"}
          </PosActionButton>
        ) : null}
        {displayShowComplete ? (
          <PosActionButton
            tone="purple"
            disabled={actionsDisabled}
            onClick={onComplete}
          >
            {isProcessing ? "Updating…" : "Complete"}
          </PosActionButton>
        ) : null}
      </div>

      {visibleMoreActions.length > 0 ? (
        <button
          type="button"
          aria-expanded={showMoreActions}
          aria-label={
            showMoreActions
              ? "Close more actions"
              : `More actions for table ${displayTableName}`
          }
          disabled={actionsDisabled}
          onClick={() => setShowMoreActions((open) => !open)}
          className={cn(
            "-mx-1 flex items-center justify-between border-t border-neutral-100 px-1 pt-2 text-left text-sm font-medium transition-colors",
            showMoreActions
              ? "text-neutral-900 hover:text-neutral-950"
              : "text-neutral-700 hover:text-neutral-800",
            actionsDisabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span
            className={cn(
              "inline-flex items-center gap-2",
              showMoreActions && "font-semibold",
            )}
          >
            {showMoreActions ? (
              <>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
                  <X className="size-3" strokeWidth={2.5} aria-hidden />
                </span>
                Close
              </>
            ) : (
              "More actions"
            )}
          </span>
          {!showMoreActions ? (
            <ChevronDown
              className="size-4 shrink-0 text-neutral-500"
              aria-hidden
            />
          ) : null}
        </button>
      ) : null}
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
      title={`Table ${displayTableName}`}
      subtitle={
        subtitleParts.length > 0
          ? subtitleParts.join(" · ")
          : "Open check on this table"
      }
      closeDisabled={isProcessing}
      contentKey={`table-map-drawer-${displayTableName}`}
      footer={actionButtons}
      footerClassName="shadow-[0_-8px_24px_rgba(0,0,0,0.06)]"
      bodyOverlay={showMoreActions}
      onBodyOverlayClick={() => setShowMoreActions(false)}
      bottomSlidePanel={moreActionsPanel}
    >
      <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
        <div className="border-b border-neutral-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Order items
        </div>
        {displayPreviewLoading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading items…
          </div>
        ) : displayPreviewError ? (
          <p className="px-3 py-4 text-sm text-red-600">
            {displayPreviewError}
          </p>
        ) : displayPreviewLines.length === 0 ? (
          <p className="px-3 py-4 text-sm text-neutral-500">
            No items on this check.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {displayPreviewLines.map((line) => (
              <PreviewLine
                key={
                  line.lineId || `${line.itemId}-${line.title}-${line.quantity}`
                }
                line={line}
              />
            ))}
          </ul>
        )}
        {displayHeldOrder?.total != null &&
        !displayPreviewLoading &&
        !displayPreviewError ? (
          <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/80 px-3 py-2.5">
            <span className="text-sm font-semibold text-neutral-700">
              Total
            </span>
            <span className="text-sm font-bold tabular-nums text-neutral-900">
              {formatMoney(displayHeldOrder.total)}
            </span>
          </div>
        ) : null}
      </div>
    </SideDrawer>
  );
}
