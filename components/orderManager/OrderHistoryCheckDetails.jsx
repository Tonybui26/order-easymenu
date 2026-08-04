"use client";

import { ModifierChoicesGrouped } from "@/lib/utils/modifierDisplay";
import { getCustomerDisplayName } from "@/lib/helper/printNameAlias";
import {
  formatOrderHistoryShortOrderId,
  formatRefundMethodLabel,
  formatRefundTypeLabel,
} from "@/lib/helper/orderHistoryDisplay";

function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function sortOrdersOldestFirst(orders = []) {
  return [...(orders || [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
}

function getDisplayItems(order) {
  return (order?.items || []).filter(
    (item) => String(item?.kitchenStatus || "").trim() !== "cancelled",
  );
}

function OrderLineItem({ item }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 text-sm">
        <div className="text-gray-900">
          {item.quantity} x {getCustomerDisplayName(item.name)}
        </div>
        {item.selectedVariants?.length > 0 ? (
          <div className="mt-1 text-xs text-gray-600">
            {item.selectedVariants.map((variant, index) => (
              <span key={`${variant.groupName}-${variant.optionName}-${index}`}>
                {getCustomerDisplayName(variant.groupName)}:{" "}
                {getCustomerDisplayName(variant.optionName)}
                {index < item.selectedVariants.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        ) : null}
        <ModifierChoicesGrouped
          modifiers={item.selectedModifiers}
          className="mt-1 text-xs text-gray-600"
        />
        {item.notes ? (
          <div className="mt-1 text-sm italic text-gray-500">
            Note: {item.notes}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-sm text-gray-900">
        {formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}
      </div>
    </div>
  );
}

function TicketItemsBlock({ order }) {
  const items = getDisplayItems(order);
  const shortId = formatOrderHistoryShortOrderId(order?._id);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="font-mono text-sm font-semibold text-gray-900">#{shortId}</p>
      <div className="space-y-3">
        {items.map((item, index) => (
          <OrderLineItem
            key={item.lineId || `${item.menuItemId}-${index}`}
            item={item}
          />
        ))}
      </div>
      <div className="flex justify-between border-t border-gray-100 pt-2 text-sm text-gray-600">
        <span>Ticket subtotal</span>
        <span>{formatCurrency(order.subtotal ?? order.total)}</span>
      </div>
    </div>
  );
}

function RefundDetailsBlock({ refundSummary }) {
  if (!refundSummary?.hasRefund) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-base font-semibold text-amber-950">Refund</h3>
      <div className="mt-3 space-y-3">
        {refundSummary.refunds.map((refund) => {
          const typeLabel = formatRefundTypeLabel(refund.refundType);
          const methodLabel = formatRefundMethodLabel(refund.refundMethod);
          const metaParts = [typeLabel];
          if (methodLabel !== "—") metaParts.push(methodLabel);

          return (
            <div
              key={refund.orderId}
              className="rounded-lg border border-amber-100 bg-white/80 p-3 text-sm text-amber-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {metaParts.join(" · ")}
                    {refundSummary.refunds.length > 1
                      ? ` · Ticket #${refund.shortId}`
                      : ""}
                  </p>
                  {refund.reason ? (
                    <p className="mt-1 text-amber-900/80">{refund.reason}</p>
                  ) : null}
                  {refund.processedAtLabel ? (
                    <p className="mt-1 text-xs text-amber-800/70">
                      {refund.processedAtLabel}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 font-semibold text-red-700">
                  -{formatCurrency(refund.amount)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrderHistoryCheckDetails({ row }) {
  const tickets = sortOrdersOldestFirst(row?.orders);
  if (tickets.length === 0) return null;

  const refundSummary = row?.refundSummary;
  const grossTotal = refundSummary?.grossTotal ?? row?.grossTotal ?? 0;
  const netTotal = refundSummary?.netTotal ?? grossTotal;
  const hasRefund = Boolean(refundSummary?.hasRefund);

  const combinedSubtotal =
    Math.round(
      tickets.reduce(
        (sum, order) => sum + Number(order.subtotal ?? order.total ?? 0),
        0,
      ) * 100,
    ) / 100;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="space-y-5">
          {tickets.map((order) => (
            <TicketItemsBlock key={String(order._id)} order={order} />
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t pt-3 text-sm">
          <div className="flex justify-between font-medium text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(combinedSubtotal)}</span>
          </div>
          {hasRefund ? (
            <>
              <div className="flex justify-between text-gray-600">
                <span>Original total</span>
                <span>{formatCurrency(grossTotal)}</span>
              </div>
              <div className="flex justify-between font-medium text-red-700">
                <span>Refunded</span>
                <span>-{formatCurrency(refundSummary.totalRefunded)}</span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between border-t pt-2 text-base font-semibold text-gray-900">
            <span>{hasRefund ? "Net total" : "Total"}</span>
            <span>{formatCurrency(netTotal)}</span>
          </div>
        </div>
      </div>

      <RefundDetailsBlock refundSummary={refundSummary} />

      {tickets.some((order) => String(order?.specialInstructions || "").trim()) ? (
        <div className="rounded-lg bg-gray-50 p-4">
          <h3 className="mb-2 text-base font-medium text-gray-900">
            Special Instructions
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            {tickets.map((order) => {
              const text = String(order.specialInstructions || "").trim();
              if (!text) return null;
              return (
                <p key={String(order._id)}>
                  <span className="font-medium">
                    #{formatOrderHistoryShortOrderId(order._id)}:
                  </span>{" "}
                  {text}
                </p>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
