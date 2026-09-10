"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  Loader2,
  Printer,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/helper";
import {
  getSelfOrderingHeldCardActions,
  isPosDineInHeldOrder,
  isTakeawayPickupHeldOrder,
} from "@/lib/pos/posHeldOrder";
import { isKitchenPrintingEnabled } from "@/lib/pos/kitchenPrintingConfig";
import { useMenuContext } from "@/components/context/MenuContext";
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

const SELF_ORDER_MORE_ACTIONS = [
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
    id: "cancel",
    label: "Cancel",
    icon: XCircle,
    tone: "red",
  },
];

function formatDrawerTitle(heldOrder) {
  if (isPosDineInHeldOrder(heldOrder)) {
    const table = String(heldOrder?.table || "").trim();
    return table ? `Table ${table}` : "Dine-in";
  }
  if (isTakeawayPickupHeldOrder(heldOrder)) {
    const name = String(heldOrder?.customerName || "").trim();
    return name || "Takeaway";
  }
  const name = String(heldOrder?.customerName || "").trim();
  return name || "Self order";
}

function formatDrawerSubtitle(heldOrder) {
  const parts = [];
  const orderType = String(heldOrder?.orderType || "").trim();
  if (orderType === "pick-up") parts.push("Takeaway");
  else if (orderType === "delivery") parts.push("Delivery");
  else if (orderType === "dine-in") parts.push("Dine-in");

  if (heldOrder?.total != null) {
    parts.push(formatMoney(heldOrder.total));
  }

  parts.push(heldOrder?.allPaid ? "Paid" : "Unpaid");
  return parts.join(" · ");
}

export default function PosSelfOrderingHeldDrawer({
  isOpen,
  onClose,
  heldOrder,
  onPrepare,
  onReady,
  onComplete,
  onPrintBill,
  onReprintOrder,
  onCancel,
  isProcessing = false,
  previewLines = [],
  isPreviewLoading = false,
  previewError = null,
}) {
  const { menuConfig } = useMenuContext();
  const kitchenPrintingEnabled = isKitchenPrintingEnabled(menuConfig);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const openSnapshotRef = useRef(null);

  if (isOpen && heldOrder) {
    openSnapshotRef.current = {
      heldOrder,
      previewLines,
      isPreviewLoading,
      previewError,
    };
  }

  useEffect(() => {
    if (!isOpen) setShowMoreActions(false);
  }, [isOpen, heldOrder?.id]);

  const snap = openSnapshotRef.current;
  if (!snap?.heldOrder) return null;

  const displayHeldOrder = snap.heldOrder;
  const displayPreviewLines = snap.previewLines || [];
  const displayPreviewLoading = Boolean(snap.isPreviewLoading);
  const displayPreviewError = snap.previewError;

  const {
    showPrepare,
    showReady,
    showComplete,
    showCancel,
    completeLabel,
  } = getSelfOrderingHeldCardActions(displayHeldOrder);

  const hasTickets = Boolean(displayHeldOrder?.orderIds?.length);
  const actionsDisabled = isProcessing || !hasTickets;
  const primaryActionCount = [showPrepare, showReady, showComplete].filter(
    Boolean,
  ).length;

  const visibleMoreActions = SELF_ORDER_MORE_ACTIONS.filter((action) => {
    if (action.id === "print-bill") return !displayHeldOrder?.allPaid;
    if (action.id === "cancel") return showCancel;
    if (action.id === "reprint-order") return kitchenPrintingEnabled;
    return true;
  });

  const actionButtons = (
    <div className="flex flex-col gap-2">
      {primaryActionCount > 0 ? (
        <div
          className={cn(
            "grid gap-2",
            primaryActionCount > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {showPrepare ? (
            <PosActionButton
              tone="blue"
              disabled={actionsDisabled}
              onClick={() => onPrepare?.(displayHeldOrder)}
            >
              {isProcessing ? "Updating…" : "Prepare"}
            </PosActionButton>
          ) : null}
          {showReady ? (
            <PosActionButton
              tone="green"
              disabled={actionsDisabled}
              onClick={() => onReady?.(displayHeldOrder)}
            >
              {isProcessing ? "Updating…" : "Ready"}
            </PosActionButton>
          ) : null}
          {showComplete ? (
            <PosActionButton
              tone="purple"
              disabled={actionsDisabled}
              onClick={() => onComplete?.(displayHeldOrder)}
              className={primaryActionCount === 1 ? undefined : "col-span-2"}
            >
              {isProcessing ? "Updating…" : completeLabel || "Complete"}
            </PosActionButton>
          ) : null}
        </div>
      ) : null}

      {visibleMoreActions.length > 0 ? (
        <button
          type="button"
          aria-expanded={showMoreActions}
          aria-label={
            showMoreActions
              ? "Close more actions"
              : "More actions for this order"
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
            if (action.id === "print-bill") onPrintBill?.(displayHeldOrder);
            if (action.id === "reprint-order")
              onReprintOrder?.(displayHeldOrder);
            if (action.id === "cancel") onCancel?.(displayHeldOrder);
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
      title={formatDrawerTitle(displayHeldOrder)}
      subtitle={formatDrawerSubtitle(displayHeldOrder)}
      closeDisabled={isProcessing}
      contentKey={`self-ordering-held-drawer-${displayHeldOrder.id}`}
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
            No items on this order.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {displayPreviewLines.map((line) => (
              <PreviewLine
                key={
                  line.lineId ||
                  `${line.sourceOrderId}-${line.itemId}-${line.title}-${line.quantity}`
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
