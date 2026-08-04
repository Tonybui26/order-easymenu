"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import toast from "react-hot-toast";
import PosChromeHeader from "./PosChromeHeader";
import OrderHistoryActionsPanel from "./OrderHistoryActionsPanel";
import RefundModal from "./RefundModal";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { fetchCompletedOrders, updateOrderStatus } from "@/lib/api/fetchApi";
import {
  buildOrderHistoryRows,
  isPosDeliveredHistoryOrder,
} from "@/lib/helper/orderHistoryDisplay";
import {
  buildHistoryRefundOrder,
  printBillForHistoryCheck,
  printReceiptForHistoryCheck,
} from "@/lib/pos/posHistoryOrderPrint";

const TABLE_COLUMNS = [
  { key: "invoice", label: "Invoice Number", className: "min-w-[9rem]" },
  { key: "date", label: "Date", className: "min-w-[10rem]" },
  { key: "customer", label: "Customer", className: "min-w-[6rem]" },
  { key: "details", label: "Order Details", className: "min-w-[8rem]" },
  { key: "payment", label: "Payment Method", className: "min-w-[8rem]" },
  { key: "total", label: "Total", className: "min-w-[5rem]" },
  { key: "actions", label: "", className: "w-12" },
];

export default function OrderHistory() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { storeProfile } = useMenuContext();
  const storeTimezone = storeProfile?.timezone || "Australia/Melbourne";

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRow, setActiveRow] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCompletedOrders();
      const rows = (data.orders || []).filter(isPosDeliveredHistoryOrder);
      setOrders(rows);
    } catch (error) {
      console.error("Error fetching order history:", error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const rows = useMemo(
    () => buildOrderHistoryRows(orders, storeTimezone),
    [orders, storeTimezone],
  );

  function closeActionsPanel() {
    setIsPanelOpen(false);
  }

  function handlePanelExitComplete() {
    setActiveRow(null);
  }

  function openActionsPanel(row) {
    setActiveRow(row);
    setIsPanelOpen(true);
  }

  async function handlePrintBill(row) {
    if (isProcessing || !row?.orders?.length) return;

    setIsProcessing(true);
    try {
      const result = await printBillForHistoryCheck(row.orders, { storeProfile });
      if (result.success) {
        toast.success(result.message || "Bill printed");
        closeActionsPanel();
      } else {
        toast.error(result.message || "Failed to print bill");
      }
    } catch (error) {
      toast.error(error?.message || "Failed to print bill");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePrintReceipt(row) {
    if (isProcessing || !row?.orders?.length) return;

    setIsProcessing(true);
    try {
      const result = await printReceiptForHistoryCheck(row.orders, {
        storeProfile,
      });
      if (result.success) {
        toast.success(result.message || "Receipt printed");
        closeActionsPanel();
      } else {
        toast.error(result.message || "Failed to print receipt");
      }
    } catch (error) {
      toast.error(error?.message || "Failed to print receipt");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRefund(row) {
    const order = buildHistoryRefundOrder(row);
    if (!order) {
      toast.error("Could not load order for refund");
      return;
    }

    if (order.paymentStatus !== "paid") {
      toast.error("This order is not eligible for refund");
      return;
    }

    setRefundOrder(order);
    setRefundModalOpen(true);
    closeActionsPanel();
  }

  async function handleDelete(row) {
    if (isProcessing || !row?.orderIds?.length) return;

    const confirmed = window.confirm(
      `Delete ${row.orderIds.length === 1 ? "this order" : "these tickets"} from order history? This will cancel the ${row.orderIds.length === 1 ? "order" : "tickets"}.`,
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      for (const orderId of row.orderIds) {
        await updateOrderStatus(orderId, "cancelled");
      }
      toast.success(
        row.orderIds.length === 1
          ? "Order deleted"
          : `${row.orderIds.length} tickets deleted`,
      );
      closeActionsPanel();
      await loadOrders();
    } catch (error) {
      toast.error(error?.message || "Failed to delete order");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRefundSuccess() {
    setRefundModalOpen(false);
    setRefundOrder(null);
    loadOrders();
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
            Order History
          </h1>

          <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100/90">
                    {TABLE_COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 ${column.className}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={TABLE_COLUMNS.length}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        <span className="loading loading-spinner loading-md text-brand_accent" />
                        <p className="mt-3">Loading order history…</p>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={TABLE_COLUMNS.length}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        No delivered POS orders yet
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.invoice}
                        </td>
                        <td className="px-4 py-3 text-gray-800">{row.date}</td>
                        <td className="px-4 py-3 text-gray-800">
                          {row.customer}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {row.details}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {row.payment}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.total}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            aria-label="Order actions"
                            aria-expanded={isPanelOpen && activeRow?.id === row.id}
                            onClick={() =>
                              isPanelOpen && activeRow?.id === row.id
                                ? closeActionsPanel()
                                : openActionsPanel(row)
                            }
                            className="inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          >
                            <MoreVertical className="size-4" strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <OrderHistoryActionsPanel
        row={activeRow}
        isOpen={isPanelOpen}
        isProcessing={isProcessing}
        onClose={closeActionsPanel}
        onExitComplete={handlePanelExitComplete}
        onPrintBill={handlePrintBill}
        onPrintReceipt={handlePrintReceipt}
        onRefund={handleRefund}
        onDelete={handleDelete}
      />

      <RefundModal
        isOpen={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false);
          setRefundOrder(null);
        }}
        order={refundOrder}
        onRefundSuccess={handleRefundSuccess}
      />
    </div>
  );
}
