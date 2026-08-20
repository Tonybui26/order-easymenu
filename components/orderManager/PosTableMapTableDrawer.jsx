"use client";

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
      footer={
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={isProcessing || !heldOrder?.orderIds?.length}
            onClick={onLoadOrder}
            className="w-full rounded-xl bg-brand_accent px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand_accent/90 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Load order
          </button>
          <button
            type="button"
            disabled={isProcessing || !heldOrder?.orderIds?.length}
            onClick={onPrintBill}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3.5 text-base font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? "Printing…" : "Print bill"}
          </button>
        </div>
      }
    >
      <p className="text-sm text-neutral-600">
        Load order to add items or take payment. Print bill sends a bill receipt
        for this table without opening the register.
      </p>
    </SideDrawer>
  );
}
