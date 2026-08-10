"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/helper";
import SideDrawer from "./SideDrawer";
import {
  POS_CANCEL_LINE_REASONS,
  POS_CANCEL_OTHER_REASON,
} from "@/lib/pos/posCancelLineReasons";

export default function DeleteOrderDrawer({
  isOpen,
  onClose,
  target,
  onConfirm,
  isProcessing = false,
}) {
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedReason("");
      setOtherReason("");
    }
  }, [isOpen, target?.id]);

  if (!target) return null;

  const resolvedReason =
    selectedReason === POS_CANCEL_OTHER_REASON
      ? otherReason.trim()
      : selectedReason.trim();

  const canConfirm = resolvedReason.length > 0 && !isProcessing;

  const handleClose = () => {
    if (!isProcessing) onClose();
  };

  const keepLabel = target.keepLabel || "Keep order";
  const confirmLabel = target.confirmLabel || "Confirm delete";
  const processingLabel = target.processingLabel || "Deleting…";
  const otherPlaceholder =
    target.otherPlaceholder || "Describe why this order is being deleted";
  const warningMessage =
    target.warningMessage ||
    `This will cancel ${
      target.ticketCount === 1
        ? "this order"
        : `these ${target.ticketCount} tickets`
    }. This action cannot be undone.`;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={target.title}
      subtitle={target.subtitle}
      closeDisabled={isProcessing}
      contentKey="delete-order-drawer"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {keepLabel}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(resolvedReason)}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isProcessing ? processingLabel : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm font-semibold text-neutral-700">
        Reason <span className="text-red-600">*</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {POS_CANCEL_LINE_REASONS.map((reason) => {
          const isSelected = selectedReason === reason;
          return (
            <button
              key={reason}
              type="button"
              disabled={isProcessing}
              onClick={() => setSelectedReason(reason)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                isSelected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400",
              )}
            >
              {reason}
            </button>
          );
        })}
      </div>

      {selectedReason === POS_CANCEL_OTHER_REASON ? (
        <textarea
          value={otherReason}
          onChange={(event) => setOtherReason(event.target.value)}
          disabled={isProcessing}
          rows={4}
          placeholder={otherPlaceholder}
          className="mt-4 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none ring-0 focus:border-neutral-500"
        />
      ) : null}

      <div className="mt-6 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900">
        {warningMessage}
      </div>
    </SideDrawer>
  );
}
