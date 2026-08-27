"use client";

import { X } from "lucide-react";

/**
 * Confirm undoing a table merge on the floor plan.
 */
export default function PosTableMapUndoMergeModal({
  isOpen,
  tableNames = [],
  keepTable = "",
  isProcessing = false,
  onClose,
  onConfirm,
}) {
  if (!isOpen) return null;

  const label =
    tableNames.length > 1
      ? `Tables ${tableNames.join(", ")}`
      : tableNames[0]
        ? `Table ${tableNames[0]}`
        : "Merged tables";

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-96 max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
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
          Undo this merge and separate the tables again.
        </p>
        {keepTable ? (
          <p className="mb-5 text-sm text-gray-600">
            Orders stay on table {keepTable}.
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
            {isProcessing ? "Undoing…" : "Undo merge"}
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
