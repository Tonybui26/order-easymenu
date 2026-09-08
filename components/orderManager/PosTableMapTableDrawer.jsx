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
        {line.notes ? (
          <p className="mt-0.5 text-xs italic text-neutral-500">
            Note: {line.notes}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function PreviewSection({ section }) {
  const lines = section?.lines || [];
  if (lines.length === 0) return null;

  const isQr = section.type === "qr";
  const total =
    section.total != null ? Number(section.total) : sectionLinesTotal(lines);
  const allPaid = Boolean(section.allPaid);

  return (
    <li
      className={cn(
        "list-none overflow-hidden rounded-xl border",
        isQr ? "border-violet-200 bg-white" : "border-neutral-200 bg-white",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b px-3 py-2",
          isQr
            ? "border-violet-100 bg-violet-50/90"
            : "border-neutral-100 bg-neutral-50",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white",
              isQr ? "bg-violet-600" : "bg-neutral-700",
            )}
          >
            {isQr ? "QR" : "POS"}
          </span>
          <span
            className={cn(
              "truncate text-sm font-semibold",
              isQr ? "text-violet-950" : "text-neutral-900",
            )}
          >
            {isQr ? section.customerName || "Guest" : "Staff order"}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            allPaid
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800",
          )}
        >
          {allPaid ? "Paid" : "Unpaid"}
        </span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {lines.map((line) => (
          <PreviewLine
            key={
              line.lineId || `${line.itemId}-${line.title}-${line.quantity}`
            }
            line={line}
          />
        ))}
      </ul>
      <div
        className={cn(
          "flex items-center justify-between border-t px-3 py-2",
          isQr
            ? "border-violet-100 bg-violet-50/50"
            : "border-neutral-100 bg-neutral-50/80",
        )}
      >
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {isQr ? "QR total" : "POS total"}
        </span>
        <span className="text-sm font-bold tabular-nums text-neutral-900">
          {formatMoney(total)}
        </span>
      </div>
    </li>
  );
}

function sectionLinesTotal(lines = []) {
  return (
    Math.round(
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity || 1);
        const unitPrice = Number(line.price || 0);
        return sum + unitPrice * qty;
      }, 0) * 100,
    ) / 100
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

function resolveDrawerTitle(title, tableName, heldOrder) {
  const explicit = String(title || "").trim();
  if (explicit) return explicit;

  const heldTables = Array.isArray(heldOrder?.tables)
    ? heldOrder.tables.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  if (heldTables.length > 1) return `Table ${heldTables.join(", ")}`;

  const name = String(tableName || heldOrder?.table || "").trim();
  return name ? `Table ${name}` : "Held check";
}

export default function PosTableMapTableDrawer({
  isOpen,
  onClose,
  tableName,
  title,
  heldOrder,
  onLoadOrder,
  onPay,
  onPrintBill,
  onReprintOrder,
  onDelete,
  onAllServed,
  onComplete,
  isProcessing = false,
  previewSections = [],
  isPreviewLoading = false,
  previewError = null,
  showAllServed = false,
  showComplete = false,
  showLoadOrder: showLoadOrderProp,
  showPay: showPayProp,
  totalLabel = "Table total",
  emptySubtitle = "Open check on this table",
}) {
  const [showMoreActions, setShowMoreActions] = useState(false);
  // Keep last open snapshot so SideDrawer can play its exit animation after
  // the parent clears tableName / heldOrder on close.
  const openSnapshotRef = useRef(null);
  const resolvedTitle = resolveDrawerTitle(title, tableName, heldOrder);

  if (isOpen && resolvedTitle) {
    openSnapshotRef.current = {
      title: resolvedTitle,
      heldOrder,
      previewSections,
      isPreviewLoading,
      previewError,
      showAllServed,
      showComplete,
      showLoadOrder: showLoadOrderProp,
      showPay: showPayProp,
      totalLabel,
      emptySubtitle,
    };
  }

  useEffect(() => {
    if (!isOpen) setShowMoreActions(false);
  }, [isOpen, resolvedTitle]);

  const snap = openSnapshotRef.current;
  if (!snap?.title) return null;

  const displayTitle = snap.title;
  const displayHeldOrder = snap.heldOrder;
  const displayPreviewSections = snap.previewSections || [];
  const displayPreviewLoading = Boolean(snap.isPreviewLoading);
  const displayPreviewError = snap.previewError;
  const displayShowAllServed = Boolean(snap.showAllServed);
  const displayShowComplete = Boolean(snap.showComplete);
  const displayTotalLabel = snap.totalLabel || "Table total";
  const displayEmptySubtitle = snap.emptySubtitle || "Open check on this table";
  const previewLineCount = displayPreviewSections.reduce(
    (sum, section) => sum + (section.lines?.length || 0),
    0,
  );

  const ticketCount = displayHeldOrder?.orderIds?.length || 0;
  const allPaid = Boolean(displayHeldOrder?.allPaid);
  // Unpaid + track food: Open + All served. Paid + track food: Complete only
  // (unless parent forces Open for paid QR context load).
  // Unpaid without serve action: Open + Pay (Print Bill lives under More).
  const showPay =
    typeof snap.showPay === "boolean"
      ? snap.showPay
      : !allPaid && !displayShowAllServed;
  const showLoadOrder =
    typeof snap.showLoadOrder === "boolean"
      ? snap.showLoadOrder
      : !displayShowComplete;
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
    if (action.id === "print-bill") return !allPaid;
    return true;
  });

  const actionButtons = (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "grid gap-2",
          showLoadOrder &&
            (showPay || displayShowAllServed || displayShowComplete)
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
              : `More actions for ${displayTitle}`
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
      title={displayTitle}
      subtitle={
        subtitleParts.length > 0
          ? subtitleParts.join(" · ")
          : displayEmptySubtitle
      }
      closeDisabled={isProcessing}
      contentKey={`held-check-drawer-${displayTitle}`}
      footer={actionButtons}
      footerClassName="shadow-[0_-8px_24px_rgba(0,0,0,0.06)]"
      bodyOverlay={showMoreActions}
      onBodyOverlayClick={() => setShowMoreActions(false)}
      bottomSlidePanel={moreActionsPanel}
    >
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Order items
        </div>
        {displayPreviewLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-100 bg-white px-3 py-8 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading items…
          </div>
        ) : displayPreviewError ? (
          <p className="rounded-xl border border-red-100 bg-white px-3 py-4 text-sm text-red-600">
            {displayPreviewError}
          </p>
        ) : previewLineCount === 0 ? (
          <p className="rounded-xl border border-neutral-100 bg-white px-3 py-4 text-sm text-neutral-500">
            No items on this check.
          </p>
        ) : (
          <ul className="space-y-3">
            {displayPreviewSections.map((section) => (
              <PreviewSection key={section.id} section={section} />
            ))}
          </ul>
        )}
        {previewLineCount > 0 &&
        !displayPreviewLoading &&
        !displayPreviewError ? (
          <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-700">
                {displayTotalLabel}
              </span>
              <span className="text-sm font-bold tabular-nums text-neutral-900">
                {formatMoney(
                  displayHeldOrder?.total != null
                    ? displayHeldOrder.total
                    : displayPreviewSections.reduce(
                        (sum, section) => sum + Number(section.total || 0),
                        0,
                      ),
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-neutral-200/80 pt-2">
              <span className="text-sm font-semibold text-amber-800">
                Total due
              </span>
              <span className="text-sm font-bold tabular-nums text-amber-900">
                {formatMoney(
                  displayHeldOrder?.amountDue != null
                    ? displayHeldOrder.amountDue
                    : displayPreviewSections.reduce(
                        (sum, section) =>
                          section.allPaid
                            ? sum
                            : sum + Number(section.total || 0),
                        0,
                      ),
                )}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </SideDrawer>
  );
}
