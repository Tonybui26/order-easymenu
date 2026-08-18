"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import DropDownList from "@/components/DropDownList";
import { useMenuContext } from "@/components/context/MenuContext";
import { cn } from "@/lib/helper";
import { refundOrder } from "@/lib/api/fetchApi";
import {
  buildRefundMethodOptions,
  canRefundPosOrderOnCard,
  getRefundMethodHelpText,
  REFUND_METHODS,
  REFUND_METHOD_LABELS,
  resolveDefaultRefundMethod,
} from "@/lib/helper/refundMethodOptions";
import {
  POS_CANCEL_LINE_REASONS,
  POS_CANCEL_OTHER_REASON,
} from "@/lib/pos/posCancelLineReasons";
import {
  isTyroPosCardReady,
  resolvePosPaymentsConfig,
} from "@/lib/pos/posPaymentsConfig";
import {
  buildTyroRefundParams,
  dollarsToTyroCents,
  getTyroIClientWithUI,
  getTyroRefundStatusMessage,
  initiateTyroRefund,
  isTyroRefundApproved,
} from "@/lib/tyro/iclient";
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
  const { menuConfig } = useMenuContext();
  const [refundType, setRefundType] = useState("");
  const [refundMethod, setRefundMethod] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [tyroRefundApproved, setTyroRefundApproved] = useState(false);
  const refundLockRef = useRef(false);

  const tyroConfig = useMemo(
    () => resolvePosPaymentsConfig(menuConfig).tyro,
    [menuConfig],
  );
  const tyroCardReady = isTyroPosCardReady(menuConfig);
  const refundMethodContext = useMemo(
    () => ({ tyroCardReady }),
    [tyroCardReady],
  );
  const posCardRefundReady = canRefundPosOrderOnCard(
    order,
    refundMethodContext,
  );

  useEffect(() => {
    if (!isOpen) {
      setRefundType("");
      setRefundMethod("");
      setSelectedReason("");
      setOtherReason("");
      setPartialAmount("");
      setTyroRefundApproved(false);
      refundLockRef.current = false;
      return;
    }

    setRefundMethod(resolveDefaultRefundMethod(order, refundMethodContext));
  }, [isOpen, order?._id, refundMethodContext]);

  useEffect(() => {
    if (!isOpen || !posCardRefundReady) return;
    getTyroIClientWithUI().catch(() => {});
  }, [isOpen, posCardRefundReady]);

  if (!order) return null;

  const refundMethodOptions = buildRefundMethodOptions(
    order,
    refundMethodContext,
  );
  const refundMethodHelpText = getRefundMethodHelpText(
    order,
    refundMethodContext,
  );
  const orderIdShort = order._id?.slice(-6).toUpperCase();
  const orderTotal = Number(order.total) || 0;
  const refundAmountPreview =
    refundType === "full"
      ? orderTotal
      : parseFloat(partialAmount) || 0;
  const needsTyroRefund =
    posCardRefundReady && refundMethod === REFUND_METHODS.CARD;

  const resolvedRefundReason =
    selectedReason === POS_CANCEL_OTHER_REASON
      ? otherReason.trim()
      : selectedReason.trim();

  const handleClose = () => {
    if (!isProcessing) onClose();
  };

  const handleConfirm = async () => {
    if (refundLockRef.current) return;

    if (!refundType) {
      toast.error("Select a refund type.");
      return;
    }

    if (!refundMethod) {
      toast.error("Select how the refund will be paid out.");
      return;
    }

    const refundAmount =
      refundType === "full" ? orderTotal : parseFloat(partialAmount);

    if (
      refundType === "partial" &&
      (!Number.isFinite(refundAmount) || refundAmount <= 0)
    ) {
      toast.error("Enter a valid partial refund amount.");
      return;
    }

    if (refundAmount > orderTotal) {
      toast.error("Refund amount cannot exceed the order total.");
      return;
    }

    if (selectedReason === POS_CANCEL_OTHER_REASON && !otherReason.trim()) {
      toast.error("Enter a reason for the refund.");
      return;
    }

    refundLockRef.current = true;
    setIsProcessing(true);
    let terminalRefundApproved = tyroRefundApproved;
    try {
      if (needsTyroRefund && !terminalRefundApproved) {
        const iclient = await getTyroIClientWithUI();
        const requestParams = buildTyroRefundParams({
          amount: dollarsToTyroCents(refundAmount),
          mid: tyroConfig?.mid,
          tid: tyroConfig?.tid,
          integrationKey: tyroConfig?.integrationKey,
          integratedReceipt: Boolean(tyroConfig?.integratedReceipt),
        });

        if (!requestParams) {
          toast.error("Invalid amount for card refund");
          return;
        }

        const result = await initiateTyroRefund(iclient, requestParams);
        if (!isTyroRefundApproved(result)) {
          toast.error(getTyroRefundStatusMessage(result));
          return;
        }

        terminalRefundApproved = true;
        setTyroRefundApproved(true);
      }

      const result = await refundOrder({
        orderId: order._id,
        refundType,
        refundMethod,
        refundReason: resolvedRefundReason || undefined,
        amount: refundAmount,
        originalAmount: orderTotal,
      });

      if (!result?.success) {
        toast.error(
          terminalRefundApproved
            ? result?.error ||
                "Card was refunded on the terminal but the order could not be updated. Do not refund again."
            : result?.error || "Refund failed.",
        );
        return;
      }

      toast.success("Refund processed.");
      if (onRefundSuccess) {
        onRefundSuccess(order._id, result);
      }
      onClose();
    } catch (error) {
      toast.error(
        terminalRefundApproved
          ? "Card was refunded on the terminal but the order could not be updated. Do not refund again."
          : error?.message || "Refund failed.",
      );
    } finally {
      refundLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const canConfirm =
    Boolean(refundType) &&
    Boolean(refundMethod) &&
    !(refundType === "partial" && !partialAmount) &&
    !(selectedReason === POS_CANCEL_OTHER_REASON && !otherReason.trim()) &&
    !isProcessing;

  const confirmLabel = isProcessing
    ? needsTyroRefund && !tyroRefundApproved
      ? "Waiting for EFTPOS…"
      : "Processing…"
    : "Confirm refund";

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
            {confirmLabel}
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
