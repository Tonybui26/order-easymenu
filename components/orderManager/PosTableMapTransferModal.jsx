"use client";

import { X } from "lucide-react";

/**
 * Confirm transferring a check / open sitting to another table.
 */
export default function PosTableMapTransferModal({
  isOpen,
  fromTable = "",
  toTable = "",
  targetOccupied = false,
  isProcessing = false,
  onClose,
  onConfirm,
}) {
  if (!isOpen) return null;

  const fromLabel = String(fromTable || "").trim() || "—";
  const toLabel = String(toTable || "").trim() || "—";

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-96 max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Transfer table
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="btn btn-circle btn-ghost btn-sm"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-1 text-sm text-gray-600">
          Transfer from table <span className="font-semibold">{fromLabel}</span>{" "}
          to table <span className="font-semibold">{toLabel}</span>?
        </p>
        {targetOccupied ? (
          <p className="mb-5 text-sm text-gray-600">
            Table {toLabel} already has an open check. The checks will be
            combined on that table.
          </p>
        ) : (
          <div className="mb-5" />
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="btn btn-error h-12 w-full text-base font-semibold text-white"
          >
            {isProcessing ? "Transferring…" : "Confirm transfer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="btn btn-ghost h-11 w-full"
          >
            Cancel
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} disabled={isProcessing}>
          close
        </button>
      </form>
    </dialog>
  );
}
