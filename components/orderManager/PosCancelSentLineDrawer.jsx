"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/helper";
import { formatPosItemDisplayName } from "@/lib/helper/printNameAlias";
import {
  POS_CANCEL_LINE_REASONS,
  POS_CANCEL_OTHER_REASON,
} from "@/lib/pos/posCancelLineReasons";

export const POS_CANCEL_SENT_LINE_DRAWER_CLOSED = {
  show: false,
  line: null,
};

export default function PosCancelSentLineDrawer({
  drawerState,
  onClose,
  onConfirm,
  isSubmitting = false,
}) {
  const line = drawerState?.line;
  const isOpen = Boolean(drawerState?.show && line);
  const lineDisplayTitle = line
    ? formatPosItemDisplayName(line.title) || line.title
    : "";
  const [portalReady, setPortalReady] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSelectedReason("");
      setOtherReason("");
    }
  }, [isOpen, line?.lineId]);

  if (!portalReady) return null;

  const resolvedReason =
    selectedReason === POS_CANCEL_OTHER_REASON
      ? otherReason.trim()
      : selectedReason.trim();

  const canConfirm = resolvedReason.length > 0 && !isSubmitting;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.button
          key="pos-cancel-line-backdrop"
          type="button"
          aria-label="Close void item drawer"
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          disabled={isSubmitting}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      ) : null}

      {isOpen ? (
        <motion.aside
          key="pos-cancel-line-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-cancel-line-title"
          className="fixed inset-y-0 right-0 z-50 flex w-[min(100%,28rem)] flex-col bg-white pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] shadow-2xl"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
            <div className="min-w-0">
              <h2
                id="pos-cancel-line-title"
                className="text-lg font-bold text-neutral-900"
              >
                Void sent item
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {lineDisplayTitle} stays on the ticket crossed out for the record.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-3 text-sm font-semibold text-neutral-700">
              Reason
            </p>
            <div className="flex flex-wrap gap-2">
              {POS_CANCEL_LINE_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    disabled={isSubmitting}
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
                disabled={isSubmitting}
                rows={4}
                placeholder="Describe why this item is being voided"
                className="mt-4 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none ring-0 focus:border-neutral-500"
              />
            ) : null}
          </div>

          <div className="flex gap-3 border-t border-neutral-200 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Keep item
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(resolvedReason)}
              className="flex-1 rounded-xl bg-[#ef3636] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e0662e] disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmitting ? "Voiding…" : "Void item"}
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
