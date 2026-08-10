"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DropDownList from "@/components/DropDownList";
import { cn } from "@/lib/helper";
import { refundOrder } from "@/lib/api/fetchApi";
import {
  buildRefundMethodOptions,
  getRefundMethodHelpText,
  REFUND_METHOD_LABELS,
  resolveDefaultRefundMethod,
} from "@/lib/helper/refundMethodOptions";
import {
  POS_CANCEL_LINE_REASONS,
  POS_CANCEL_OTHER_REASON,
} from "@/lib/pos/posCancelLineReasons";
import SideDrawer from "./SideDrawer";

const refundTypeOptions = [
  {
    id: "full",
    name: "Full refund",
    description: "Refund the entire order amount",
  },
  {
    id: "partial",
    name: "Partial refund",
    description: "Refund a portion of the order amount",
  },
];

const dropdownSummaryClassName =
  "rounded-lg border-gray-300 bg-gray-100 text-base font-normal hover:bg-gray-100 hover:text-black";

function formatCurrency(amount) {
  return `$${Number(amount ?? 0).toFixed(2)}`;
}

export default function RefundModal({
  isOpen,
  onClose,
  order,
  onRefundSuccess,
}) {
  const [refundType, setRefundType] = useState("");
  const [refundMethod, setRefundMethod] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRefundType("");
      setRefundMethod("");
      setSelectedReason("");
      setOtherReason("");
      setPartialAmount("");
      return;
    }

    setRefundMethod(resolveDefaultRefundMethod(order));
  }, [isOpen, order?._id]);

  if (!order) return null;

  const refundMethodOptions = buildRefundMethodOptions(order);
  const refundMethodHelpText = getRefundMethodHelpText(order);
  const orderIdShort = order._id?.slice(-6).toUpperCase();
  const refundAmountPreview =
    refundType === "full"
      ? Number(order.total)
      : parseFloat(partialAmount) || 0;

  const resolvedRefundReason =
    selectedReason === POS_CANCEL_OTHER_REASON
      ? otherReason.trim()
      : selectedReason.trim();

  const handleClose = () => {
    if (!isProcessing) onClose();
  };

  const handleConfirm = async () => {
    if (!refundType) {
      toast.error("Select a refund type.");
      return;
    }

    if (!refundMethod) {
      toast.error("Select how the refund will be paid out.");
      return;
    }

    if (
      refundType === "partial" &&
      (!partialAmount || parseFloat(partialAmount) <= 0)
    ) {
      toast.error("Enter a valid partial refund amount.");
      return;
    }

    if (selectedReason === POS_CANCEL_OTHER_REASON && !otherReason.trim()) {
      toast.error("Enter a reason for the refund.");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await refundOrder({
        orderId: order._id,
        refundType,
        refundMethod,
        refundReason: resolvedRefundReason || undefined,
        amount:
          refundType === "full" ? order.total : parseFloat(partialAmount),
        originalAmount: order.total,
      });

      if (!result?.success) {
        toast.error(result?.error || "Refund failed.");
        return;
      }

      toast.success("Refund processed.");
      if (onRefundSuccess) {
        onRefundSuccess(order._id, result);
      }
      onClose();
    } catch (error) {
      toast.error(error?.message || "Refund failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const canConfirm =
    Boolean(refundType) &&
    Boolean(refundMethod) &&
    !(refundType === "partial" && !partialAmount) &&
    !(selectedReason === POS_CANCEL_OTHER_REASON && !otherReason.trim()) &&
    !isProcessing;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={`Refund order #${orderIdShort}`}
      subtitle={`Total ${formatCurrency(order.total)} · This cannot be undone.`}
      closeDisabled={isProcessing}
      contentKey="refund-drawer"
      bodyClassName="space-y-6 px-5 py-4"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isProcessing ? "Processing…" : "Confirm refund"}
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-neutral-700">
          Refund type <span className="text-red-600">*</span>
        </label>
        <DropDownList
          options={refundTypeOptions}
          value={refundType}
          onChange={setRefundType}
          placeholder="Select refund type"
          disabled={isProcessing}
          summaryClassName={dropdownSummaryClassName}
        />
      </div>

      {refundType === "partial" && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-700">
            Refund amount <span className="text-red-600">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={partialAmount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setPartialAmount(value);
                }
              }}
              placeholder="0.00"
              disabled={isProcessing}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 py-2.5 pl-8 pr-3 text-base text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-500"
            />
          </div>
          <p className="text-xs text-neutral-500">
            Maximum: {formatCurrency(order.total)}
          </p>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-semibold text-neutral-700">
          Refund method <span className="text-red-600">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {refundMethodOptions.map((option) => {
            const isSelected = refundMethod === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={isProcessing || refundMethodOptions.length === 1}
                onClick={() => setRefundMethod(option.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  isSelected
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">{refundMethodHelpText}</p>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-neutral-700">
          Reason (optional)
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
            placeholder="Describe why this order is being refunded"
            className="mt-4 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none ring-0 focus:border-neutral-500"
          />
        ) : null}
      </div>

      {refundType ? (
        <div className="rounded-xl bg-neutral-100 p-4 text-sm">
          <p className="font-semibold text-neutral-900">Refund summary</p>
          <div className="mt-2 space-y-1 text-neutral-700">
            <div className="flex justify-between gap-4">
              <span>Type</span>
              <span className="font-medium">
                {refundTypeOptions.find((o) => o.id === refundType)?.name}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Amount</span>
              <span className="font-semibold text-red-700">
                {formatCurrency(refundAmountPreview)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Method</span>
              <span className="font-medium">
                {REFUND_METHOD_LABELS[refundMethod] || refundMethod}
              </span>
            </div>
            {resolvedRefundReason ? (
              <div className="flex justify-between gap-4">
                <span>Reason</span>
                <span className="max-w-[60%] text-right font-medium">
                  {resolvedRefundReason}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900">
        This action is immediate and cannot be undone. The refund will be
        processed instantly.
      </div>
    </SideDrawer>
  );
}
