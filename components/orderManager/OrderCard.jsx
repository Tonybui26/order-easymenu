import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  Check,
  X,
  ChefHat,
  Bell,
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  CreditCard,
  AlertTriangle,
  DollarSign,
  Banknote,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";

export default function OrderCard({
  order,
  onPrepare,
  onReady,
  onDeliver,
  onCancel,
  onMarkAsPaid,
  showMarkAsPaid = false,
  viewMode,
}) {
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);

  // Format the time since order was created
  const timeAgo = formatDistanceToNow(new Date(order.createdAt), {
    addSuffix: true,
  });

  // Check if this is a table order or takeaway
  const isTableOrder = order.table && order.table !== "takeaway";

  // Check payment status
  const isPaid = order.paymentStatus === "paid";
  const isPending = order.paymentStatus === "pending";
  const isFailed = order.paymentStatus === "failed";

  // Helper function to check if payment method is a counter payment
  const isCounterPayment = (paymentMethod) => {
    return (
      paymentMethod === "cash" ||
      paymentMethod === "counter-cash" ||
      paymentMethod === "counter-card"
    );
  };

  // Determine which action buttons to show based on current status and order type
  const isCounterOrder = isCounterPayment(order.paymentMethod);
  const isCounterPending = isCounterOrder && order.status === "pending";
  const isCounterConfirmed =
    isCounterOrder &&
    order.status === "confirmed" &&
    order.paymentStatus === "pending";

  // ===== COMPREHENSIVE BUTTON LOGIC =====

  // 1. CONFIRM BUTTON (Legacy - not used for counter orders)
  const showConfirmButton = false;

  // 2. PREPARE BUTTON
  const showPrepareButton = (() => {
    // Never show prepare button for completed/cancelled orders
    if (["ready", "delivered", "cancelled"].includes(order.status)) {
      return false;
    }

    // For non-counter orders (online payments)
    if (!isCounterOrder) {
      return order.status === "confirmed"; // Only when confirmed
    }

    // For counter orders (dine-in)
    if (isCounterOrder) {
      // Must be paid AND in a state where preparation can start
      return (
        order.paymentStatus === "paid" &&
        ["pending", "confirmed"].includes(order.status)
      );
    }

    return false;
  })();

  // 3. READY BUTTON
  const showReadyButton = (() => {
    // Only for online takeaway/pickup orders that are preparing
    if (
      !isCounterOrder &&
      (order.table === "takeaway" || order.table === "pickup") &&
      order.status === "preparing"
    ) {
      return true;
    }
    return false;
  })();

  // 4. DELIVER/COMPLETE BUTTON
  const showDeliverButton = (() => {
    // For online dine-in orders: show after preparing (skip ready status)
    if (!isCounterOrder && isTableOrder && order.status === "preparing") {
      return true;
    }

    // For online takeaway/pickup orders: show after ready status
    if (
      !isCounterOrder &&
      (order.table === "takeaway" || order.table === "pickup") &&
      order.status === "ready"
    ) {
      return true;
    }

    // For counter orders (dine-in only): show after preparing (skip ready status)
    if (isCounterOrder && order.status === "preparing") {
      return true;
    }

    return false;
  })();

  // 5. MARK AS PAID BUTTON
  const showMarkAsPaidButton = (() => {
    // Only show if explicitly enabled and order needs payment
    if (!showMarkAsPaid) return false;

    // Must be a counter payment method
    if (!isCounterPayment(order.paymentMethod)) return false;

    // Must be unpaid
    if (order.paymentStatus !== "pending") return false;

    // Can be any status (pending, confirmed, preparing, ready) but not delivered/cancelled
    if (["delivered", "cancelled"].includes(order.status)) return false;

    return true;
  })();

  // Status styling - Apple-like subtle colors
  const getStatusStyle = (status) => {
    switch (status) {
      case "pending":
        return {
          background: "bg-orange-100",
          text: "text-orange-700",
          border: "border-orange-200",
          dot: "bg-orange-500",
        };
      case "confirmed":
        return {
          background: "bg-blue-100",
          text: "text-blue-700",
          border: "border-blue-200",
          dot: "bg-blue-500",
        };
      case "preparing":
        return {
          background: "bg-purple-100",
          text: "text-purple-700",
          border: "border-purple-200",
          dot: "bg-purple-500",
        };
      case "ready":
        return {
          background: "bg-green-100",
          text: "text-green-700",
          border: "border-green-200",
          dot: "bg-green-500",
        };
      case "delivered":
        return {
          background: "bg-green-100",
          text: "text-green-700",
          border: "border-green-200",
          dot: "bg-green-500",
        };
      case "cancelled":
        return {
          background: "bg-gray-100",
          text: "text-gray-700",
          border: "border-gray-200",
          dot: "bg-gray-400",
        };
      default:
        return {
          background: "bg-gray-100",
          text: "text-gray-700",
          border: "border-gray-200",
          dot: "bg-gray-400",
        };
    }
  };

  // Payment status styling
  const getPaymentStatusStyle = (paymentStatus) => {
    switch (paymentStatus) {
      case "paid":
        return {
          background: "bg-green-100",
          text: "text-green-700",
          border: "border-green-200",
          dot: "bg-green-500",
        };
      case "pending":
        return {
          background: "bg-yellow-100",
          text: "text-yellow-700",
          border: "border-yellow-200",
          dot: "bg-yellow-500",
        };
      case "failed":
        return {
          background: "bg-red-100",
          text: "text-red-700",
          border: "border-red-200",
          dot: "bg-red-500",
        };
      case "refunded":
        return {
          background: "bg-gray-100",
          text: "text-gray-700",
          border: "border-gray-200",
          dot: "bg-gray-400",
        };
      default:
        return {
          background: "bg-gray-100",
          text: "text-gray-700",
          border: "border-gray-200",
          dot: "bg-gray-400",
        };
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "confirmed":
        return "Confirmed";
      case "preparing":
        return "Preparing";
      case "ready":
        return "Ready";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return "Unknown";
    }
  };

  const getPaymentStatusText = (paymentStatus) => {
    switch (paymentStatus) {
      case "paid":
        if (order.paymentMethod === "counter-cash") return "Cash Paid";
        if (order.paymentMethod === "counter-card") return "Card Paid";
        if (order.paymentMethod === "cash") return "Cash Paid"; // Legacy support
        return "Paid";
      case "pending":
        if (isCounterPayment(order.paymentMethod)) return "Not Paid";
        return "Payment Pending";
      case "failed":
        return "Payment Failed";
      case "refunded":
        return "Refunded";
      default:
        return "Unknown";
    }
  };

  // Handle cancel with different behavior based on payment status
  const handleCancel = () => {
    if (isPending) {
      // For pending payments, cancel immediately without warning
      onCancel();
    } else {
      // For paid orders, show confirmation (this logic should be in parent component)
      onCancel();
    }
  };

  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-100 bg-neutral-100 shadow-md transition-all duration-200 hover:border-gray-200">
      <div>
        {/* Header */}
        <div className="p-6 pb-4">
          {/* show me a order status banner here and it only visible in order completed mode */}
          {viewMode === "completed" && (
            <div
              className={`mb-1 inline-block rounded-md border p-2 ${
                order.status === "delivered"
                  ? "border-green-300 bg-gradient-to-r from-green-50 to-emerald-50"
                  : "border-red-300 bg-gradient-to-r from-red-50 to-pink-50"
              }`}
            >
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold capitalize ${
                      order.status === "delivered"
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    {order.status === "delivered" ? "Completed" : "Cancelled"}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-start justify-between">
            {/* Time Ago */}
            <div className="mb-1 inline-flex items-center justify-end py-1 text-xs text-gray-500">
              <Clock className="mr-1 h-3 w-3" strokeWidth={1.5} />
              {timeAgo}
            </div>
            {/* Payment Status */}
            <div className="">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border ${getPaymentStatusStyle(order.paymentStatus).border} px-2 py-1 text-xs font-semibold ${getPaymentStatusStyle(order.paymentStatus).background}`}
              >
                {order.paymentMethod === "counter-cash" ||
                order.paymentMethod === "cash" ? (
                  <Banknote
                    className={`size-4 ${getPaymentStatusStyle(order.paymentStatus).text}`}
                    strokeWidth={2}
                  />
                ) : order.paymentMethod === "counter-card" ? (
                  <CreditCard
                    className={`size-4 ${getPaymentStatusStyle(order.paymentStatus).text}`}
                    strokeWidth={2}
                  />
                ) : (
                  <CreditCard
                    className={`size-4 ${getPaymentStatusStyle(order.paymentStatus).text}`}
                    strokeWidth={2}
                  />
                )}
                <span
                  className={`text-xs font-medium ${getPaymentStatusStyle(order.paymentStatus).text}`}
                >
                  {getPaymentStatusText(order.paymentStatus)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              {/* temp hide */}
              <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
                {isTableOrder ? (
                  <MapPin className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
                ) : (
                  <Package
                    className="h-5 w-5 text-gray-600"
                    strokeWidth={1.5}
                  />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold leading-tight text-gray-900">
                  {isTableOrder ? `Table ${order.table}` : "Pick-up"}
                </h3>
                <p className="text-sm font-medium text-gray-500">
                  #{order._id.slice(-6).toUpperCase()}
                </p>
                {/* Pickup info */}
                {!isTableOrder && (
                  <div className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
                    Pickup at:{" "}
                    <span className="text-base font-semibold">
                      {order.pickupTime || "ASAP"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              {/* Order Status - Temporary hidden - list status include: pending, confirmed, preparing, ready, delivered, cancelled */}
              <div
                className={`hidden items-center gap-1.5 rounded-full border ${getStatusStyle(order.status).border} px-2 py-1 text-xs font-semibold ${getStatusStyle(order.status).background}`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${getStatusStyle(order.status).dot}`}
                ></div>
                <span
                  className={`text-sm font-medium ${getStatusStyle(order.status).text}`}
                >
                  {getStatusText(order.status)}
                </span>
              </div>
              {/* Customer info */}
              {order.customerName && (
                <div className="rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 flex-col items-end">
                      <p className="truncate text-xl font-semibold text-gray-900">
                        {order.customerName}
                      </p>

                      {/* Customer info toggle button */}
                      {(order.customerPhone || order.customerEmail) && (
                        <button
                          onClick={() => setShowCustomerInfo(!showCustomerInfo)}
                          className="mt-2 flex items-center gap-1.5 text-sm text-blue-600 transition-colors hover:text-blue-800 hover:underline"
                        >
                          {showCustomerInfo ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              Hide Info
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              Show Info
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hidden customer info that appears when toggled */}
                  {showCustomerInfo && (
                    <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                      {order.customerPhone && (
                        <div className="flex items-center">
                          <Phone
                            className="mr-2 h-3.5 w-3.5 text-gray-500"
                            strokeWidth={1.5}
                          />
                          <p className="text-sm text-gray-700">
                            {order.customerPhone}
                          </p>
                        </div>
                      )}
                      {order.customerEmail && (
                        <div className="flex items-center">
                          <Mail
                            className="mr-2 h-3.5 w-3.5 text-gray-500"
                            strokeWidth={1.5}
                          />
                          <p className="text-sm text-gray-700">
                            {order.customerEmail}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Payment Warning for Failed/Pending- hidden temporarily */}
          {(isPending || isFailed) && (
            <div
              className={`mb-4 hidden rounded-xl border p-3 ${
                isFailed
                  ? "border-red-200 bg-red-50"
                  : "border-yellow-200 bg-yellow-50"
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    isFailed ? "text-red-600" : "text-yellow-600"
                  }`}
                  strokeWidth={1.5}
                />
                <p
                  className={`text-sm font-medium ${
                    isFailed ? "text-red-800" : "text-yellow-800"
                  }`}
                >
                  {isFailed
                    ? "Payment failed - Customer needs to retry payment"
                    : isCounterPayment(order.paymentMethod)
                      ? "Counter payment pending"
                      : "Payment pending - Waiting for customer payment"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-gray-100"></div>

        {/* Order Items */}
        <div className="p-6 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">Items</h4>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                {order.items.length}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div
                key={index}
                className="flex items-start justify-between py-2"
              >
                <div className="flex flex-1 items-start space-x-3">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900">
                    <span className="text-xs font-semibold text-white">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.selectedVariants &&
                      item.selectedVariants.length > 0 && (
                        <p className="text-sm text-gray-600">
                          {item.selectedVariants
                            .map(
                              (variant) =>
                                `${variant.groupName} (${variant.optionName})`,
                            )
                            .join(" - ")}
                        </p>
                      )}
                    {item.selectedModifiers &&
                      item.selectedModifiers.length > 0 && (
                        <p className="text-sm text-blue-600">
                          +{" "}
                          {item.selectedModifiers
                            .map(
                              (modifier) =>
                                `${modifier.groupName} (${modifier.optionName})`,
                            )
                            .join(", ")}
                        </p>
                      )}
                    {item.notes && (
                      <div className="mt-2 rounded-lg border border-yellow-100 bg-yellow-50 p-2">
                        <p className="mb-1 text-xs font-medium text-yellow-800">
                          Note
                        </p>
                        <p className="text-xs text-yellow-700">{item.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
                <p className="ml-4 font-semibold text-gray-900">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Special Instructions */}
          {order.specialInstructions && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-1 text-sm font-medium text-blue-900">
                Instructions
              </p>
              <p className="text-sm text-blue-800">
                {order.specialInstructions}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Actions */}
      <div className="p-6 pt-0">
        <div className="flex space-x-3">
          {showConfirmButton && (
            <button
              onClick={onPrepare}
              className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-blue-700"
            >
              <ChefHat className="h-4 w-4" strokeWidth={1.5} />
              <span>Prepare</span>
            </button>
          )}

          {showPrepareButton && (
            <button
              onClick={onPrepare}
              className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-blue-700"
            >
              <ChefHat className="h-4 w-4" strokeWidth={1.5} />
              <span>Prepare</span>
            </button>
          )}

          {showReadyButton && (
            <button
              onClick={onReady}
              className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-green-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-green-700"
            >
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              <span>Ready</span>
            </button>
          )}

          {showDeliverButton && (
            <button
              onClick={onDeliver}
              className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-purple-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-purple-700"
            >
              <Check className="h-4 w-4" strokeWidth={1.5} />
              <span>Complete</span>
            </button>
          )}

          {showMarkAsPaidButton && (
            <button
              onClick={() => onMarkAsPaid(order._id)}
              className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-green-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-green-700"
            >
              <Banknote className="h-4 w-4" strokeWidth={1.5} />
              <span>Mark as Paid</span>
            </button>
          )}

          {/* Only show cancel button if order is not already cancelled or delivered */}
          {!["cancelled", "delivered"].includes(order.status) && (
            <button
              onClick={onCancel}
              className="flex items-center justify-center space-x-2 rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-200"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
