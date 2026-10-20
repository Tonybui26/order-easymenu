"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { DatePicker } from "@/components/DatePicker";
import PosChromeHeader from "./PosChromeHeader";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { fetchCompletedOrders } from "@/lib/api/fetchApi";
import {
  formatReceiptDate,
  formatReceiptDayMonth,
} from "@/lib/printers/receipt/receiptLayoutHelpers";
import { isStoreStorageOptimizer } from "@/lib/store/isStorageOptimizer";
import { printSalesReportReceipt } from "@/lib/printers/printSalesReportReceipt";
import { buildSalesTrend, summarizeSales } from "@/lib/helper/salesSummary";
import { pendingLocalSalesOrders } from "@/lib/helper/salesSummaryLocal";
import {
  listLocalSendRecords,
  listPendingOfflinePayments,
  onOfflinePaymentSynced,
  onOfflineSendSynced,
} from "@/lib/localDb/offlineSendStore";

const SalesSummaryChart = dynamic(() => import("./SalesSummaryChart"), {
  ssr: false,
});

const REPORTS = [{ id: "sales-summary", label: "Sales Summary" }];

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function todayKey() {
  return format(new Date(), "yyyy-MM-dd");
}

function startOfDay(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setHours(23, 59, 59, 999);
  return date;
}

const ROWS = [
  { key: "salesCount", label: "Number of sales", money: false },
  { key: "discountsTotal", label: "Discounts total" },
  { key: "cashPayments", label: "Cash payments" },
  { key: "creditCardPayments", label: "Card payments" },
  { key: "otherPayments", label: "Other payments" },
  { key: "totalSales", label: "Total sales amount", emphasis: true },
  {
    key: "weekendSurcharge",
    label: "Weekend surcharge",
    section: "Surcharges",
    indent: true,
  },
  { key: "serviceSurcharge", label: "Service surcharge", indent: true },
  { key: "totalSurcharge", label: "Total surcharge", emphasis: true },
  {
    key: "cashRefunds",
    label: "Cash refunds",
    section: "Refunds",
    indent: true,
  },
  { key: "creditCardRefunds", label: "Credit card refunds", indent: true },
  { key: "otherRefunds", label: "Other refunds", indent: true },
  { key: "totalRefunds", label: "Total refund", emphasis: true },
];

export default function SalesSummary() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { storeProfile, menuConfig } = useMenuContext();
  const storageOptimizerOn = isStoreStorageOptimizer(menuConfig);
  const [activeReport, setActiveReport] = useState(REPORTS[0].id);
  const [draftRange, setDraftRange] = useState(() => {
    const today = todayKey();
    return { from: today, to: today };
  });
  const [appliedFrom, setAppliedFrom] = useState(() => startOfDay(todayKey()));
  const [appliedTo, setAppliedTo] = useState(() => endOfDay(todayKey()));
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const startMs = appliedFrom.getTime();
    const endMs = appliedTo.getTime();
    let serverOrders = [];
    try {
      const data = await fetchCompletedOrders(
        appliedFrom.toISOString(),
        appliedTo.toISOString(),
      );
      serverOrders = data?.orders || [];
    } catch (loadError) {
      console.error("Error fetching sales summary:", loadError);
      setError(
        "Could not load synced sales. Showing sales still on this device.",
      );
    }

    let localOrders = [];
    try {
      const [localSends, pendingPayments] = await Promise.all([
        listLocalSendRecords(),
        listPendingOfflinePayments(),
      ]);
      localOrders = pendingLocalSalesOrders({
        localSends,
        pendingPayments,
        serverOrders,
        startMs,
        endMs,
      });
    } catch (loadError) {
      console.error("Error reading local sales:", loadError);
    }

    setOrders([...serverOrders, ...localOrders]);
    setIsLoading(false);
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const stopSend = onOfflineSendSynced(() => {
      loadSummary();
    });
    const stopPay = onOfflinePaymentSynced(() => {
      loadSummary();
    });
    return () => {
      stopSend();
      stopPay();
    };
  }, [loadSummary]);

  const summary = useMemo(() => summarizeSales(orders), [orders]);
  const trend = useMemo(
    () => buildSalesTrend(orders, appliedFrom, appliedTo),
    [orders, appliedFrom, appliedTo],
  );

  async function handlePrint() {
    if (isPrinting || isLoading) return;
    setIsPrinting(true);
    try {
      const result = await printSalesReportReceipt({
        storeName: storeProfile?.storeName || "",
        dateFromLabel: storageOptimizerOn
          ? formatReceiptDayMonth(appliedFrom)
          : formatReceiptDate(appliedFrom),
        dateToLabel: storageOptimizerOn
          ? formatReceiptDayMonth(appliedTo)
          : formatReceiptDate(appliedTo),
        summary,
      });
      if (result.success) {
        toast.success(result.message || "Sales summary printed");
      } else {
        toast.error(result.message || "Failed to print sales summary");
      }
    } catch (printError) {
      toast.error(printError?.message || "Failed to print sales summary");
    } finally {
      setIsPrinting(false);
    }
  }

  function handleFilter() {
    if (!draftRange?.from || !draftRange?.to) {
      setError("Choose a from and to date.");
      return;
    }
    const from = startOfDay(draftRange.from);
    const to = endOfDay(draftRange.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      setError("Choose a valid from and to date.");
      return;
    }
    if (from > to) {
      setError("From must be before to.");
      return;
    }
    setError("");
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-44 shrink-0 flex-col border-r border-gray-200 bg-[#f3f3f3] sm:w-56">
          <p className="px-4 pb-2 pt-4 text-xs font-medium text-gray-500">
            Reports
          </p>
          <nav aria-label="Reports">
            {REPORTS.map((report) => {
              const isActive = report.id === activeReport;
              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setActiveReport(report.id)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                    isActive
                      ? "bg-[#f6d2c4] font-semibold text-neutral-900"
                      : "text-neutral-700 hover:bg-black/[0.04]"
                  }`}
                >
                  {report.label}
                  {isActive ? (
                    <ChevronRight className="size-4 shrink-0" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || isLoading}
              className="h-10 rounded-md bg-[#2563eb] px-5 text-sm font-bold uppercase tracking-wide text-white transition active:scale-[0.99] disabled:opacity-50"
            >
              {isPrinting ? "Printing…" : "Print"}
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DatePicker
              value={draftRange}
              enableDateRange
              onChange={setDraftRange}
              placeholder="Select date"
              className="w-full min-w-56 sm:w-auto"
            />
            <button
              type="button"
              onClick={handleFilter}
              className="h-10 rounded-md bg-brand_accent px-5 text-sm font-bold uppercase tracking-wide text-white transition active:scale-[0.99]"
            >
              Filter
            </button>
            </div>
          </div>

          {error ? (
            <p className="px-4 py-3 text-sm text-red-600 sm:px-6">{error}</p>
          ) : null}

          {isLoading ? (
            <div className="px-4 py-16 text-center text-gray-500">
              <span className="loading loading-spinner loading-md text-brand_accent" />
              <p className="mt-3">Loading sales summary…</p>
            </div>
          ) : (
            <>
              <SalesSummaryChart data={trend} />
              <dl>
                {ROWS.map((row) => (
                  <div key={row.key}>
                    {row.section ? (
                      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        {row.section}
                      </div>
                    ) : null}
                    <div
                      className={`flex items-baseline justify-between gap-4 border-t border-gray-100 py-3 ${
                        row.indent
                          ? "pl-8 pr-4 sm:pl-10 sm:pr-6"
                          : "px-4 sm:px-6"
                      } ${
                        row.emphasis
                          ? "bg-gray-50 font-semibold text-gray-900"
                          : "text-gray-800"
                      }`}
                    >
                      <dt>{row.label}</dt>
                      <dd className="tabular-nums">
                        {row.money === false
                          ? summary[row.key]
                          : formatMoney(summary[row.key])}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
