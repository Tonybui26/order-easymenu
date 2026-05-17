"use client";

import { format } from "date-fns";
import { CreditCard } from "lucide-react";
import { isCounterPayment } from "@/lib/helper/payLater";

function InfoRow({ label, value, valueClassName = "", href }) {
  if (value == null || value === "") return null;

  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="shrink-0 text-sm text-gray-500">{label}</span>
      {href ? (
        <a
          href={href}
          className={`text-right text-sm font-medium text-blue-600 hover:underline ${valueClassName}`}
        >
          {value}
        </a>
      ) : (
        <span
          className={`text-right text-sm font-medium text-gray-900 ${valueClassName}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function InfoSection({ children, className = "" }) {
  return <div className={`space-y-0 ${className}`}>{children}</div>;
}

function formatPlacedAt(createdAt) {
  if (!createdAt) return null;
  try {
    return format(new Date(createdAt), "EEE, MMM d, h:mma");
  } catch {
    return null;
  }
}

function formatDeliveryAddress(order) {
  const line = String(order.deliveryAddress ?? "").trim();
  if (line) return line;

  const detail = order.deliveryAddressDetail;
  if (!detail) return null;

  const parts = [
    detail.streetLine1,
    detail.unit,
    detail.city,
    detail.stateOrRegion,
    detail.postcode,
  ].filter((part) => String(part ?? "").trim());

  return parts.length > 0 ? parts.join(", ") : null;
}

function getPaymentMethodLabel(paymentMethod) {
  switch (paymentMethod) {
    case "counter-cash":
    case "cash":
      return "Cash";
    case "counter-card":
      return "Card";
    case "credit_card":
      return "Credit card";
    case "stripe":
      return "Stripe";
    case "apple_pay":
      return "Apple Pay";
    case "google_pay":
      return "Google Pay";
    default:
      return paymentMethod ? String(paymentMethod).replace(/_/g, " ") : "—";
  }
}

function getPaymentStatusLabel(order, payLaterEnabled) {
  const { paymentStatus, paymentMethod, isPayLater } = order;

  switch (paymentStatus) {
    case "paid":
      if (paymentMethod === "counter-cash" || paymentMethod === "cash") {
        return "Paid (cash)";
      }
      if (paymentMethod === "counter-card") return "Paid (card)";
      return "Paid";
    case "pending":
      if (payLaterEnabled && isPayLater) return "Pay later";
      if (isCounterPayment(paymentMethod)) return "Not paid";
      return "Payment pending";
    case "failed":
      return "Payment failed";
    case "refunded":
      return "Refunded";
    default:
      return paymentStatus || "—";
  }
}

export default function OrderCardMoreInfo({
  order,
  isDineIn,
  isDelivery,
  isPickUp,
  payLaterEnabled = false,
}) {
  const placedAt = formatPlacedAt(order.createdAt);
  const fulfillmentTime = order.pickupTime || "ASAP";
  const deliveryAddress = isDelivery ? formatDeliveryAddress(order) : null;
  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const surchargeTotal = Number(order.surchargeTotal ?? 0);
  const total = Number(order.total ?? 0);

  const hasCustomerSection =
    order.customerName || order.customerPhone || order.customerEmail;

  return (
    <div>
      <InfoSection>
        <InfoRow label="Placed" value={placedAt} />
        {isDineIn && order.table && order.table !== "takeaway" && (
          <InfoRow label="Table" value={order.table} />
        )}
        {isPickUp && (
          <InfoRow
            label={order.isPreorder ? "Scheduled pick-up" : "Pick-up time"}
            value={fulfillmentTime}
          />
        )}
        {isDelivery && (
          <>
            <InfoRow
              label={order.isPreorder ? "Scheduled delivery" : "Delivery time"}
              value={fulfillmentTime}
            />
            <InfoRow label="Delivery address" value={deliveryAddress} />
          </>
        )}
      </InfoSection>

      {hasCustomerSection && (
        <InfoSection className="border-t border-[#e3e3e3]">
          <InfoRow label="Customer name" value={order.customerName} />
          <InfoRow
            label="Customer phone"
            value={order.customerPhone}
            href={
              order.customerPhone
                ? `tel:${String(order.customerPhone).replace(/\s/g, "")}`
                : undefined
            }
          />
          <InfoRow
            label="Customer email"
            value={order.customerEmail}
            href={
              order.customerEmail ? `mailto:${order.customerEmail}` : undefined
            }
          />
        </InfoSection>
      )}

      <InfoSection className="border-t border-[#e3e3e3]">
        <InfoRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
        {surchargeTotal > 0 && (
          <InfoRow label="Surcharges" value={`$${surchargeTotal.toFixed(2)}`} />
        )}
        <InfoRow
          label="Total"
          value={`$${total.toFixed(2)}`}
          valueClassName="font-bold"
        />
        <InfoRow
          label="Payment"
          value={getPaymentStatusLabel(order, payLaterEnabled)}
        />
        {/* <InfoRow
          label="Payment method"
          value={getPaymentMethodLabel(order.paymentMethod)}
        /> */}
      </InfoSection>
    </div>
  );
}
