"use client";

import { Plus } from "lucide-react";
import { isCounterPayment } from "@/lib/helper/payLater";
import { getCollectAmountSummary } from "@/lib/helper/orderCollectAmount";
import { combineOrderItemsForTable } from "@/lib/helper/unpaidTableOrders";
import { ModifierChoicesGrouped } from "@/lib/utils/modifierDisplay";
import { getCustomerDisplayName } from "@/lib/helper/printNameAlias";

export default function UnpaidTableCard({
  table,
  tableOrders,
  showPayMultipleTables = false,
  payLaterAtCounterEnabled = false,
  onPayMultipleTables,
  onMarkOrderPaid,
  onMarkAllPaid,
}) {
  const tableCollectSummary = getCollectAmountSummary(tableOrders);
  const combinedItemsArray = combineOrderItemsForTable(tableOrders);
  const pendingCollectionOrders = tableOrders.filter(
    (order) =>
      order.paymentStatus === "pending" &&
      isCounterPayment(order.paymentMethod),
  );

  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-lg border border-gray-100 bg-neutral-100 shadow-md transition-all duration-200 hover:border-gray-200">
      <div>
        <div className="p-4 pb-4 xl:p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <div>
                <h3 className="text-2xl font-extrabold leading-tight text-gray-800 xl:text-xl">
                  Table {table}
                </h3>
                <p className="text-xs font-medium text-gray-500 xl:text-sm">
                  {tableOrders.length} order
                  {tableOrders.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-gray-600">
                  {tableOrders
                    .map(
                      (order) =>
                        `${order.customerName || "Anonymous"} ($${order.total.toFixed(2)})`,
                    )
                    .join(", ")}
                </p>
                <p className="text-xs text-gray-600">
                  Total: ${tableCollectSummary.total.toFixed(2)}
                </p>
              </div>
            </div>
            {showPayMultipleTables && (
              <button
                type="button"
                onClick={onPayMultipleTables}
                className="btn btn-circle btn-ghost btn-sm shrink-0 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                aria-label="Pay multiple tables"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-gray-300" />

        <div className="p-4 pb-6 pt-2 xl:p-6">
          <div className="space-y-0.5 xl:space-y-2">
            {combinedItemsArray.map((item, index) => (
              <div
                key={index}
                className="flex items-start justify-between py-1 transition-all duration-200 xl:py-2"
              >
                <div className="flex flex-1 items-start space-x-3">
                  <span className="text-base font-bold text-gray-800">
                    {item.quantity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-gray-800 xl:text-base">
                      {getCustomerDisplayName(item.name)}
                    </p>
                    {item.selectedVariants?.length > 0 && (
                      <p className="text-sm text-gray-600">
                        {item.selectedVariants
                          .map(
                            (variant) =>
                              `${variant.groupName} (${getCustomerDisplayName(variant.optionName)})`,
                          )
                          .join(" - ")}
                      </p>
                    )}
                    <ModifierChoicesGrouped
                      modifiers={item.selectedModifiers}
                      className="text-sm text-gray-700"
                    />
                  </div>
                </div>
                <p className="ml-4 text-base font-bold text-gray-800 xl:text-base">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 pt-0 xl:p-6">
        <div className="mb-3 space-y-2">
          {pendingCollectionOrders.map((order) => (
            <div
              key={order._id}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-sm text-gray-600">
                {order.customerName || "Guest"} · ${order.total.toFixed(2)}
                {payLaterAtCounterEnabled && order.isPayLater
                  ? " · Pay later"
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => onMarkOrderPaid(order._id)}
                className="shrink-0 rounded-lg border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-50"
              >
                Mark as Paid
              </button>
            </div>
          ))}
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => onMarkAllPaid(tableOrders)}
            className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-green-700 xl:text-base"
          >
            <span>Mark All Paid</span>
          </button>
        </div>
      </div>
    </div>
  );
}
