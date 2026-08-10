"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/helper";
import SideDrawer from "./SideDrawer";
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
  useKitchenPrintAliases = false,
}) {
  const line = drawerState?.line;
  const isOpen = Boolean(drawerState?.show && line);
  const lineDisplayTitle = line
    ? formatPosItemDisplayName(line.title, { useKitchenPrintAliases }) ||
      line.title
    : "";
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedReason("");
      setOtherReason("");
    }
  }, [isOpen, line?.lineId]);

  const resolvedReason =
    selectedReason === POS_CANCEL_OTHER_REASON
      ? otherReason.trim()
      : selectedReason.trim();

  const canConfirm = resolvedReason.length > 0 && !isSubmitting;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Void sent item"
      subtitle={
        lineDisplayTitle
          ? `${lineDisplayTitle} stays on the ticket crossed out for the record.`
          : undefined
      }
      closeDisabled={isSubmitting}
      zIndex={40}
      contentKey="pos-cancel-line-drawer"
      footer={
        <div className="flex gap-3">
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
      }
    >
      <p className="mb-3 text-sm font-semibold text-neutral-700">Reason</p>
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
    </SideDrawer>
  );
}
