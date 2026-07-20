"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { refundOrder } from "@/lib/api/fetchApi";

const refundTypeOptions = [
  { id: "full", label: "Full refund" },
  { id: "partial", label: "Partial refund" },
];

const refundReasonOptions = [
  { id: "wrong_order", label: "Wrong order" },
  { id: "out_of_stock", label: "Out of stock" },
  { id: "long_wait", label: "Long wait time" },
  { id: "other", label: "Other" },
];

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
  const [refundReason, setRefundReason] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRefundType("");
      setRefundReason("");
      setPartialAmount("");
    }
  }, [isOpen]);

  if (!order) return null;

  const orderIdShort = order._id?.slice(-6).toUpperCase();
  const refundAmountPreview =
    refundType === "full"
      ? Number(order.total)
      : parseFloat(partialAmount) || 0;

  const handleClose = () => {
    if (!isProcessing) onClose();
  };

  const handleConfirm = async () => {
    if (!refundType) {
      toast.error("Select a refund type.");
      return;
    }

    if (
      refundType === "partial" &&
      (!partialAmount || parseFloat(partialAmount) <= 0)
    ) {
      toast.error("Enter a valid partial refund amount.");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await refundOrder({
        orderId: order._id,
        refundType,
        refundReason,
        amount:
          refundType === "full" ? order.total : parseFloat(partialAmount),
        originalAmount: order.total,
      });

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

  return (
    <dialog
      className={`modal ${isOpen ? "modal-open" : ""}`}
      aria-labelledby="refund-modal-title"
    >
      <div className="modal-box max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="refund-modal-title"
            className="text-lg font-bold text-gray-800"
          >
            Refund order #{orderIdShort}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="btn btn-circle btn-ghost btn-sm disabled:pointer-events-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Refund type <span className="text-red-600">*</span>
            <select
              value={refundType}
              onChange={(e) => setRefundType(e.target.value)}
              disabled={isProcessing}
              className="select select-bordered mt-2 w-full rounded-lg bg-gray-100 text-base"
            >
              <option value="">Select refund type</option>
              {refundTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {refundType === "partial" && (
            <label className="block text-sm font-medium text-gray-700">
              Refund amount <span className="text-red-600">*</span>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
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
                  className="input input-md w-full rounded-lg border-2 bg-gray-200 pl-8 text-base placeholder:text-neutral-500 focus:border-brand_accent/70 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Maximum: {formatCurrency(order.total)}
              </p>
            </label>
          )}

          <label className="block text-sm font-medium text-gray-700">
            Reason (optional)
            <select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              disabled={isProcessing}
              className="select select-bordered mt-2 w-full rounded-lg bg-gray-100 text-base"
            >
              <option value="">Select reason (optional)</option>
              {refundReasonOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {refundType && (
            <div className="rounded-lg bg-gray-100 p-4 text-sm">
              <p className="font-medium text-gray-900">Refund summary</p>
              <div className="mt-2 space-y-1 text-gray-700">
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className="font-medium">
                    {
                      refundTypeOptions.find((o) => o.id === refundType)
                        ?.label
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Amount</span>
                  <span className="font-semibold text-red-700">
                    {formatCurrency(refundAmountPreview)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900">
            This action is immediate and cannot be undone. The refund will be
            processed instantly.
          </div>
        </div>

        <div className="modal-action">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="btn btn-outline btn-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isProcessing ||
              !refundType ||
              (refundType === "partial" && !partialAmount)
            }
            className="btn btn-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isProcessing ? "Processing…" : "Confirm refund"}
          </button>
        </div>
      </div>
      <form
        method="dialog"
        className="modal-backdrop"
        onClick={handleClose}
      >
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
