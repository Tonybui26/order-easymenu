"use client";

import { X } from "lucide-react";
import { isPayLaterEligible } from "@/lib/helper/payLater";
import {
  getCollectAmountSummary,
  isPendingCounterOrderForCollection,
} from "@/lib/helper/orderCollectAmount";
import {
  formatUnpaidTablesLabel,
  getDistinctTablesFromOrders,
} from "@/lib/helper/unpaidTableOrders";

export const PAYMENT_METHOD_MODAL_CLOSED = {
  orderId: null,
  tableOrders: null,
  isBulk: false,
  show: false,
};

export default function PaymentMethodModal({
  isOpen,
  isBulk,
  orderId,
  tableOrders,
  orders,
  menuConfig,
  onClose,
  onSelectPaymentMethod,
  onPayLater,
}) {
  const modalOrder =
    !isBulk && orderId ? orders.find((o) => o._id === orderId) : null;
  const showPayLaterOption =
    modalOrder &&
    isPayLaterEligible(modalOrder, menuConfig) &&
    !modalOrder.isPayLater;

  const collectAmountSummary = isBulk
    ? getCollectAmountSummary(tableOrders ?? [], isPendingCounterOrderForCollection)
    : modalOrder
      ? getCollectAmountSummary([modalOrder])
      : { total: 0, surchargeTotal: 0, orderCount: 0 };

  const bulkTableNames =
    isBulk && tableOrders?.length
      ? getDistinctTablesFromOrders(tableOrders)
      : [];
  const bulkTablesLabel = formatUnpaidTablesLabel(bulkTableNames);

  return (
    <dialog className={`modal ${isOpen ? "modal-open" : ""}`}>
      <div className="modal-box w-[400px] max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isBulk
              ? bulkTableNames.length > 1
                ? `Bulk payment — ${bulkTablesLabel}`
                : "Bulk Payment Method"
              : "Select Payment Method"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-circle btn-ghost btn-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-6 text-sm text-gray-600">
          {isBulk
            ? bulkTableNames.length > 1
              ? `How did the customer pay for all orders at ${bulkTablesLabel}?`
              : `How did the customer pay for all orders at Table ${tableOrders?.[0]?.table}?`
            : "How did the customer pay at the counter?"}
        </p>

        <div className="mb-6 rounded-lg bg-gray-200 p-4 text-center">
          <p className="mb-1 text-sm font-medium text-gray-600">
            {isBulk ? "Total Amount to Collect:" : "Amount to Collect:"}
          </p>
          <div className="text-4xl font-bold text-gray-900">
            ${collectAmountSummary.total.toFixed(2)}
          </div>
          {collectAmountSummary.surchargeTotal > 0 && (
            <p className="mt-1 text-base text-gray-500">
              Includes surcharges $
              {collectAmountSummary.surchargeTotal.toFixed(2)}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onSelectPaymentMethod("cash")}
            className="btn btn-outline h-auto w-full justify-start gap-3 p-4"
          >
            <span className="text-2xl">💵</span>
            <span className="text-left">
              <span className="block font-medium">Cash</span>
              <span className="block text-sm text-gray-500">
                Physical cash payment
              </span>
            </span>
          </button>

          {menuConfig?.allowCardPaymentAtCounter && (
            <button
              type="button"
              onClick={() => onSelectPaymentMethod("card")}
              className="btn btn-outline h-auto w-full justify-start gap-3 p-4"
            >
              <span className="text-2xl">💳</span>
              <span className="text-left">
                <span className="block font-medium">Card</span>
                <span className="block text-sm text-gray-500">
                  Credit/debit card payment
                </span>
              </span>
            </button>
          )}

          {showPayLaterOption && (
            <button
              type="button"
              onClick={onPayLater}
              className="btn btn-outline h-auto w-full justify-start gap-3 p-4"
            >
              <span className="text-2xl">🕐</span>
              <span className="text-left">
                <span className="block font-medium">Pay Later</span>
                <span className="block text-sm text-gray-500">
                  Prepare food now; collect payment after
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button type="button">close</button>
      </form>
    </dialog>
  );
}
