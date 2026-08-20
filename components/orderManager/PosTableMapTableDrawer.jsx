"use client";

import { cn } from "@/lib/helper";
import SideDrawer from "./SideDrawer";

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

export default function PosTableMapTableDrawer({
  isOpen,
  onClose,
  tableName,
  heldOrder,
  onLoadOrder,
  onPrintBill,
  isProcessing = false,
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
        <p className="text-sm text-neutral-600">
          Load order to add items or take payment. Print bill sends a bill
          receipt for this table without opening the register.
        </p>

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-100 bg-neutral-50/80 p-3">
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
