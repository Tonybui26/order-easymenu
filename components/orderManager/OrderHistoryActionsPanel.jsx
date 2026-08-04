"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Receipt, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/helper";
import OrderHistoryCheckDetails from "./OrderHistoryCheckDetails";

const HISTORY_ACTIONS = [
  {
    id: "print-bill",
    label: "Print Bill",
    icon: FileText,
    className: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",
  },
  {
    id: "print-receipt",
    label: "Print Receipt",
    icon: Receipt,
    className: "bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white",
  },
  {
    id: "refund",
    label: "Refund",
    icon: RotateCcw,
    className:
      "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white",
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    className: "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white",
  },
];

const PANEL_SPRING = { type: "spring", damping: 28, stiffness: 320 };

/**
 * Slide-in action panel from the right (Order History table rows).
 */
export default function OrderHistoryActionsPanel({
  row,
  isOpen,
  isProcessing = false,
  onClose,
  onExitComplete,
  onPrintBill,
  onPrintReceipt,
  onRefund,
  onDelete,
}) {
  const lastRowRef = useRef(null);

  useEffect(() => {
    if (row) lastRowRef.current = row;
  }, [row]);

  const displayRow = row ?? lastRowRef.current;

  const visibleActions = HISTORY_ACTIONS.filter((action) => {
    if (action.id === "refund") {
      return displayRow?.primaryAction === "refund";
    }
    if (action.id === "delete") {
      return displayRow?.primaryAction === "delete";
    }
    return true;
  });

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isOpen && displayRow ? (
        <>
          <motion.button
            key="order-history-backdrop"
            type="button"
            aria-label="Close actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />

          <motion.aside
            key={`order-history-panel-${displayRow.id}`}
            role="dialog"
            aria-modal="true"
            aria-label={`Actions for invoice ${displayRow.invoice}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={PANEL_SPRING}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-neutral-200 bg-gray-50 shadow-[-12px_0_40px_rgba(0,0,0,0.12)] sm:max-w-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200 bg-white px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Invoice
                </p>
                <p className="mt-1 truncate text-lg font-bold text-neutral-900">
                  {displayRow.invoice}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  {displayRow.drawerSubtitle}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <OrderHistoryCheckDetails row={displayRow} />
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-neutral-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {visibleActions.map((action) => {
                const Icon = action.icon;
                const disabled =
                  isProcessing &&
                  (action.id === "print-bill" || action.id === "print-receipt");

                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (action.id === "print-bill") onPrintBill?.(displayRow);
                      if (action.id === "print-receipt")
                        onPrintReceipt?.(displayRow);
                      if (action.id === "refund") onRefund?.(displayRow);
                      if (action.id === "delete") onDelete?.(displayRow);
                    }}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold tracking-wide transition-colors",
                      action.className,
                      (action.id === "refund" || action.id === "delete") &&
                        "col-span-2",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Icon size={16} strokeWidth={2} aria-hidden />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
