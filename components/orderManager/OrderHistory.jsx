"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MoreVertical,
  Search,
  Banknote,
  CreditCard,
  Calendar,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import InputText from "@/components/InputText";
import DropdownSelect from "@/components/DropdownSelect";
import PosChromeHeader from "./PosChromeHeader";
import OrderHistoryActionsPanel from "./OrderHistoryActionsPanel";
import EmailReceiptModal from "./EmailReceiptModal";
import RefundModal from "./RefundModal";
import DeleteOrderDrawer from "./DeleteOrderDrawer";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { fetchCompletedOrders, updateOrderStatus } from "@/lib/api/fetchApi";
import {
  buildOrderHistoryRows,
  filterOrderHistoryRows,
  getOrderHistoryDateRangeUTC,
  isHistoryOrder,
  pickHistoryReceiptEmail,
  pickHistoryReceiptOrder,
  pickHistoryRefundConfirmationOrder,
  ORDER_HISTORY_DATE_FILTER_OPTIONS,
  ORDER_HISTORY_DATE_FILTER_TODAY,
  ORDER_HISTORY_PAYMENT_FILTER_ALL,
  ORDER_HISTORY_PAYMENT_FILTER_OPTIONS,
  formatOrderHistoryRefundBadgeLabel,
  formatOrderHistoryCustomer,
  formatOrderHistoryDate,
  formatOrderHistoryOrderDetails,
  formatOrderHistoryDrawerSubtitle,
  formatOrderHistoryPaymentMethod,
} from "@/lib/helper/orderHistoryDisplay";
import { cn } from "@/lib/helper";
import {
  buildHistoryRefundOrder,
  printBillForHistoryCheck,
  printReceiptForHistoryCheck,
} from "@/lib/pos/posHistoryOrderPrint";
import SendRefundConfirmationModal from "./SendRefundConfirmationModal";
import {
  listLocalSendRecords,
  listPendingOfflinePayments,
  onOfflinePaymentSynced,
  onOfflineSendSynced,
} from "@/lib/localDb/offlineSendStore";

const TABLE_COLUMNS = [
  { key: "invoice", label: "Invoice Number", className: "min-w-[9rem]" },
  { key: "date", label: "Date", className: "min-w-[10rem]" },
  { key: "customer", label: "Customer", className: "min-w-[6rem]" },
  { key: "details", label: "Order Details", className: "min-w-[8rem]" },
  { key: "payment", label: "Payment Method", className: "min-w-[8rem]" },
  { key: "total", label: "Total", className: "min-w-[5rem]" },
  { key: "actions", label: "", className: "w-12" },
  { key: "sync", label: "", className: "w-12" },
];

const PAYMENT_FILTER_ICONS = {
  Online: CreditCard,
  Cash: Banknote,
  Card: CreditCard,
};

const PAYMENT_FILTER_OPTIONS = ORDER_HISTORY_PAYMENT_FILTER_OPTIONS.map(
  (option) => ({
    ...option,
    Icon: PAYMENT_FILTER_ICONS[option.id],
  }),
);

function OrderHistorySyncIcon({ pending }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        pending ? "text-amber-500" : "text-emerald-600",
      )}
      title={pending ? "Saved on this device, not synced yet" : "Synced"}
      aria-label={pending ? "Waiting to sync" : "Synced"}
    >
      <RefreshCw className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

function localSendTotal(payload) {
  return (payload?.items || []).reduce(
    (sum, item) =>
      sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
}

function pendingHistoryOrder(record, paymentMethod) {
  const payload = record.payload || {};
  const createdAt =
    payload.clientCreatedAt || new Date(record.createdAt).toISOString();
  const method =
    String(paymentMethod || payload.paymentMethod || "").trim() || null;
  const isPaid =
    Boolean(method) ||
    String(payload.paymentStatus || "").trim() === "paid";
  return {
    _id: record.localId,
    clientLocalId: record.localId,
    posCheckId: record.posCheckId,
    createdAt,
    customerName: payload.customerName || "",
    customerPhone: payload.customerPhone || "",
    customerEmail: payload.customerEmail || "",
    orderType: payload.orderType,
    table: payload.table,
    tables: payload.tables,
    items: payload.items || [],
    total: localSendTotal(payload),
    paymentStatus: isPaid ? "paid" : "pending",
    ...(method ? { paymentMethod: method } : {}),
    status: payload.kitchenStatus || "preparing",
    source: "pos",
    pendingSync: true,
  };
}

function OrderHistoryRefundBadge({ badge }) {
  const label = formatOrderHistoryRefundBadgeLabel(badge);
  if (!label) return null;

  return (
    <span
      className={cn(
        "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        badge === "partial"
          ? "bg-amber-100 text-amber-800"
          : "bg-neutral-200 text-neutral-700",
      )}
    >
      {label}
    </span>
  );
}

const DATE_FILTER_OPTIONS = ORDER_HISTORY_DATE_FILTER_OPTIONS.map((option) => ({
  ...option,
  Icon: Calendar,
}));

export default function OrderHistory() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { storeProfile } = useMenuContext();
  const storeTimezone = storeProfile?.timezone || "Australia/Melbourne";

  const [orders, setOrders] = useState([]);
  const [localSends, setLocalSends] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState(ORDER_HISTORY_DATE_FILTER_TODAY);
  const [paymentFilter, setPaymentFilter] = useState(
    ORDER_HISTORY_PAYMENT_FILTER_ALL,
  );
  const [activeRow, setActiveRow] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [refundConfirmationOrder, setRefundConfirmationOrder] = useState(null);
  const [refundConfirmationModalOpen, setRefundConfirmationModalOpen] =
    useState(false);
  const reopenRowIdAfterRefundRef = useRef(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = getOrderHistoryDateRangeUTC(dateFilter);
      const data = await fetchCompletedOrders(startDate, endDate);
      const nextOrders = (data.orders || []).filter(isHistoryOrder);
      setOrders(nextOrders);
      return nextOrders;
    } catch (error) {
      console.error("Error fetching order history:", error);
      setOrders([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadLocalSends = useCallback(async () => {
    const [records, payments] = await Promise.all([
      listLocalSendRecords(),
      listPendingOfflinePayments(),
    ]);
    setLocalSends(records);
    setPendingPayments(payments);
  }, []);

  useEffect(() => {
    void loadLocalSends();
    const stopSend = onOfflineSendSynced(() => {
      void loadLocalSends();
    });
    const stopPay = onOfflinePaymentSynced(() => {
      void loadLocalSends();
    });
    return () => {
      stopSend();
      stopPay();
    };
  }, [loadLocalSends]);

  const rows = useMemo(() => {
    const serverRows = buildOrderHistoryRows(orders, storeTimezone).map(
      (row) => ({ ...row, syncPending: false }),
    );
    const { startDate, endDate } = getOrderHistoryDateRangeUTC(dateFilter);
    const startMs = Date.parse(startDate);
    const endMs = Date.parse(endDate);
    const pending = localSends.filter(
      (record) =>
        record.status !== "synced" &&
        !record.serverOrderId &&
        String(record.payload?.kitchenStatus || "").trim() !== "cancelled" &&
        record.createdAt >= startMs &&
        record.createdAt <= endMs,
    );
    const methodByLocalId = new Map();
    for (const payment of pendingPayments) {
      const method = String(payment.method || "").trim();
      if (!method) continue;
      for (const id of payment.localIds || []) {
        const key = String(id);
        if (!methodByLocalId.has(key)) methodByLocalId.set(key, method);
      }
    }

    const byCheck = new Map();
    for (const record of pending) {
      const key = record.posCheckId || record.localId;
      if (!byCheck.has(key)) byCheck.set(key, []);
      byCheck.get(key).push(record);
    }
    const pendingRows = [...byCheck.values()].map((records) => {
      const ordered = [...records].sort((a, b) => a.createdAt - b.createdAt);
      const method =
        ordered
          .map(
            (record) =>
              String(record.payload?.paymentMethod || "").trim() ||
              methodByLocalId.get(String(record.localId)) ||
              "",
          )
          .find(Boolean) || null;
      const group = ordered.map((record) => pendingHistoryOrder(record, method));
      const primary = group[group.length - 1];
      const ticketCount = group.length;
      return {
        id: `local:${ordered[0].posCheckId || ordered[0].localId}`,
        orderIds: group.map((order) => order._id),
        orders: group,
        invoice: "Pending",
        isCancelled: false,
        date: formatOrderHistoryDate(primary.createdAt, storeTimezone),
        customer: formatOrderHistoryCustomer(primary),
        details: formatOrderHistoryOrderDetails(primary, ticketCount),
        drawerSubtitle: formatOrderHistoryDrawerSubtitle(primary, ticketCount),
        payment: formatOrderHistoryPaymentMethod(method) || "—",
        refundBadge: null,
        grossTotal: localSendTotal(ordered[0].payload),
        refundSummary: null,
        primaryAction: null,
        total: `$${group
          .reduce((sum, order) => sum + Number(order.total || 0), 0)
          .toFixed(2)}`,
        timezone: storeTimezone,
        syncPending: true,
        createdAtMs: ordered[ordered.length - 1].createdAt,
      };
    });
    pendingRows.sort((a, b) => b.createdAtMs - a.createdAtMs);

    const paymentRows = pendingPayments.flatMap((payment) => {
      const stillSending = (payment.localIds || []).some((id) =>
        pending.some((record) => record.localId === id),
      );
      if (stillSending) return [];
      const method = String(payment.method || "").trim() || null;
      const records = (payment.localIds || [])
        .map((id) => localSends.find((record) => record.localId === id))
        .filter(Boolean);
      const createdAt =
        records[0]?.createdAt || payment.createdAt || Date.now();
      if (createdAt < startMs || createdAt > endMs) return [];
      const total = records.reduce(
        (sum, record) => sum + localSendTotal(record.payload),
        0,
      );
      const amount = total > 0 ? total : Number(payment.amountTendered || 0);
      const historyOrders = records.map((record) =>
        pendingHistoryOrder(record, method),
      );
      return [
        {
          id: `pay:${payment.localPaymentId}`,
          orderIds: records.map((record) => record.serverOrderId || record.localId),
          orders: historyOrders,
          invoice: "Pending",
          isCancelled: false,
          date: formatOrderHistoryDate(createdAt, storeTimezone),
          customer: historyOrders[0]
            ? formatOrderHistoryCustomer(historyOrders[0])
            : "—",
          details: historyOrders[0]
            ? formatOrderHistoryOrderDetails(historyOrders[0], records.length || 1)
            : "Payment",
          drawerSubtitle: historyOrders[0]
            ? formatOrderHistoryDrawerSubtitle(historyOrders[0], records.length || 1)
            : "Payment",
          payment: formatOrderHistoryPaymentMethod(method) || "—",
          refundBadge: null,
          grossTotal: amount,
          refundSummary: null,
          primaryAction: null,
          total: `$${amount.toFixed(2)}`,
          timezone: storeTimezone,
          syncPending: true,
          createdAtMs: createdAt,
        },
      ];
    });
    paymentRows.sort((a, b) => b.createdAtMs - a.createdAtMs);

    return [...pendingRows, ...paymentRows, ...serverRows];
  }, [dateFilter, localSends, orders, pendingPayments, storeTimezone]);

  const filteredRows = useMemo(
    () => filterOrderHistoryRows(rows, searchQuery, paymentFilter),
    [rows, searchQuery, paymentFilter],
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
      const result = await printBillForHistoryCheck(row.orders, {
        storeProfile,
      });
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

  function handleEmailReceipt(row) {
    const order = pickHistoryReceiptOrder(row?.orders);
    if (!order?._id) {
      toast.error("Could not load order for receipt");
      return;
    }

    setReceiptTarget({
      orderId: String(order._id),
      defaultEmail: pickHistoryReceiptEmail(row?.orders),
    });
    setReceiptModalOpen(true);
  }

  function handleSendRefundConfirmation(row) {
    const order = pickHistoryRefundConfirmationOrder(row?.orders);
    if (!order?._id) {
      toast.error("Could not load refund details");
      return;
    }

    setRefundConfirmationOrder(order);
    setRefundConfirmationModalOpen(true);
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

    reopenRowIdAfterRefundRef.current = row?.id || null;
    setRefundOrder(order);
    setRefundModalOpen(true);
    closeActionsPanel();
  }

  function handleDelete(row) {
    if (isProcessing || !row?.orderIds?.length) return;

    setDeleteTarget({
      id: row.id,
      title: `Delete order ${row.invoice}`,
      subtitle: row.drawerSubtitle,
      orderIds: row.orderIds,
      ticketCount: row.orderIds.length,
    });
    setDeleteDrawerOpen(true);
    closeActionsPanel();
  }

  async function handleConfirmDelete(cancelReason) {
    if (isProcessing || !deleteTarget?.orderIds?.length) return;

    setIsProcessing(true);
    try {
      for (const orderId of deleteTarget.orderIds) {
        await updateOrderStatus(orderId, "cancelled", {
          cancelReason,
          requireCancelReason: true,
        });
      }
      toast.success(
        deleteTarget.orderIds.length === 1
          ? "Order deleted"
          : `${deleteTarget.orderIds.length} tickets deleted`,
      );
      setDeleteDrawerOpen(false);
      setDeleteTarget(null);
      await loadOrders();
    } catch (error) {
      toast.error(error?.message || "Failed to delete order");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRefundSuccess() {
    const reopenRowId = reopenRowIdAfterRefundRef.current;
    reopenRowIdAfterRefundRef.current = null;
    setRefundModalOpen(false);
    setRefundOrder(null);

    const nextOrders = await loadOrders();
    if (!reopenRowId) return;

    const nextRows = buildOrderHistoryRows(nextOrders, storeTimezone);
    const match = nextRows.find((row) => row.id === reopenRowId);
    if (match) openActionsPanel(match);
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
              Order History
            </h1>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <InputText
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search invoice, customer, order…"
                  aria-label="Search order history"
                  className="pl-9"
                />
              </div>
              <DropdownSelect
                options={DATE_FILTER_OPTIONS}
                value={dateFilter}
                onChange={setDateFilter}
                ariaLabel="Filter by date"
                showIcons
                className="w-full sm:w-44"
              />
              <DropdownSelect
                options={PAYMENT_FILTER_OPTIONS}
                value={paymentFilter}
                onChange={setPaymentFilter}
                ariaLabel="Filter by payment type"
                showIcons
                className="w-full sm:w-48"
              />
            </div>
          </div>

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
                        {dateFilter === ORDER_HISTORY_DATE_FILTER_TODAY
                          ? "No orders today"
                          : "No orders for this date"}
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={TABLE_COLUMNS.length}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        {searchQuery.trim()
                          ? `No orders match “${searchQuery.trim()}”`
                          : "No orders match this payment filter"}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {row.invoice}
                          </div>
                          {row.isCancelled ? (
                            <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-800">
                              Cancelled
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-800">{row.date}</td>
                        <td className="px-4 py-3 text-gray-800">
                          {row.customer}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {row.details}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-800">{row.payment}</div>
                          <OrderHistoryRefundBadge badge={row.refundBadge} />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.total}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            aria-label="Order actions"
                            aria-expanded={
                              isPanelOpen && activeRow?.id === row.id
                            }
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
                        <td className="px-4 py-3 text-right">
                          <OrderHistorySyncIcon pending={row.syncPending} />
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
        onEmailReceipt={handleEmailReceipt}
        onSendRefundConfirmation={handleSendRefundConfirmation}
        onRefund={handleRefund}
        onDelete={handleDelete}
      />

      <EmailReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptTarget(null);
        }}
        orderId={receiptTarget?.orderId}
        defaultEmail={receiptTarget?.defaultEmail}
        onSent={closeActionsPanel}
      />

      <SendRefundConfirmationModal
        isOpen={refundConfirmationModalOpen}
        onClose={() => {
          setRefundConfirmationModalOpen(false);
          setRefundConfirmationOrder(null);
        }}
        order={refundConfirmationOrder}
      />

      <RefundModal
        isOpen={refundModalOpen}
        onClose={() => {
          reopenRowIdAfterRefundRef.current = null;
          setRefundModalOpen(false);
          setRefundOrder(null);
        }}
        order={refundOrder}
        onRefundSuccess={handleRefundSuccess}
      />

      <DeleteOrderDrawer
        isOpen={deleteDrawerOpen}
        onClose={() => {
          if (isProcessing) return;
          setDeleteDrawerOpen(false);
          setDeleteTarget(null);
        }}
        target={deleteTarget}
        onConfirm={handleConfirmDelete}
        isProcessing={isProcessing}
      />
    </div>
  );
}
