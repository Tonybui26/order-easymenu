"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, X } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/helper";
import {
  closePosRegisterSession,
  closePosRegisterSessionSecondTest,
  fetchPosRegisterClosingPreview,
  finalisePosRegisterSession,
} from "@/lib/api/fetchApi";
import { registerOperatorPayload } from "@/lib/pos/registerOperatorPayload";
import { getPosHomePath } from "@/lib/pos/posConfig";
import { isStoreSecondTest } from "@/lib/store/isSecondTest";
import {
  clearLocalRegisterFinalise,
  patchLocalRegisterFinalise,
  saveLocalRegisterFinalise,
} from "@/lib/localDb/registerFinaliseStore";
import {
  sumPendingOutboxCardSalesSince,
  sumPendingOutboxCashSalesSince,
} from "@/lib/localDb/offlineSendStore";
import { printSalesReportReceipt } from "@/lib/printers/printSalesReportReceipt";
import { isStaffPinLockEnabled } from "@/lib/staff/staffRoles";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import { useMenuContext } from "@/components/context/MenuContext";
import { usePosRegisterSession } from "@/components/context/PosRegisterSessionContext";

const KEYPAD_ROWS = [
  ["1", "2", "3", "backspace"],
  ["4", "5", "6", "10"],
  ["7", "8", "9", "20"],
  ["0", "00", ".", "50"],
];

const QUICK_AMOUNTS = new Set(["10", "20", "50"]);

export const CASH_DENOMINATIONS = [
  { id: "100-notes", label: "$100 Notes", cents: 10000 },
  { id: "50-notes", label: "$50 Notes", cents: 5000 },
  { id: "20-notes", label: "$20 Notes", cents: 2000 },
  { id: "10-notes", label: "$10 Notes", cents: 1000 },
  { id: "5-notes", label: "$5 Notes", cents: 500 },
  { id: "2-coins", label: "$2 Coins", cents: 200 },
  { id: "1-coins", label: "$1 Coins", cents: 100 },
  { id: "50-cents", label: "50 cent Coins", cents: 50 },
  { id: "20-cents", label: "20 cent Coins", cents: 20 },
  { id: "10-cents", label: "10 cent Coins", cents: 10 },
  { id: "5-cents", label: "5 cent Coins", cents: 5 },
];

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatCountDisplay(value) {
  if (value === "" || value == null) return "0";
  return String(value);
}

function parseCount(digits) {
  if (digits === "" || digits == null) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countToDigits(count) {
  if (count == null || count === 0) return "";
  return String(count);
}

function denominationAmount(denomination, count) {
  if (!denomination || !count) return 0;
  return (denomination.cents * count) / 100;
}

function countsFromSession(session) {
  const next = {};
  for (const row of session?.closingCounts || []) {
    if (row?.denomId != null) next[row.denomId] = Number(row.count) || 0;
  }
  return next;
}

function buildCountsPayload(countsMap) {
  return CASH_DENOMINATIONS.filter((d) => countsMap[d.id] != null).map((d) => ({
    denomId: d.id,
    label: d.label,
    cents: d.cents,
    count: Number(countsMap[d.id]) || 0,
  }));
}

function computeActualFromCounts(countsMap) {
  return CASH_DENOMINATIONS.reduce(
    (sum, denomination) =>
      sum + denominationAmount(denomination, countsMap[denomination.id]),
    0,
  );
}

function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

function formatSalesReportDate(date = new Date()) {
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Close Register — denomination counts + finalise / close.
 */
export default function PosRegisterClose({ session, onSessionUpdated }) {
  const router = useRouter();
  const { activeOperator, lock } = useActiveOperator();
  const { menuConfig, storeProfile } = useMenuContext();
  const { setRegisterClosed, setRegisterOpen } = usePosRegisterSession();
  const posHomePath = getPosHomePath(menuConfig);
  const secondTestOn = isStoreSecondTest(menuConfig);
  const pinLockEnabled = isStaffPinLockEnabled(menuConfig);
  const [counts, setCounts] = useState(() => countsFromSession(session));
  const [selectedId, setSelectedId] = useState(null);
  const [digits, setDigits] = useState("");
  const [isFinalised, setIsFinalised] = useState(
    Boolean(session?.countsFinalised),
  );
  const [cashExpected, setCashExpected] = useState(
    session?.closingExpected ?? null,
  );
  const [cashVariance, setCashVariance] = useState(
    session?.closingVariance ?? null,
  );
  const [localClosingActual, setLocalClosingActual] = useState(
    session?.locallyFinalised ? session?.closingActual ?? null : null,
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isMismatchOpen, setIsMismatchOpen] = useState(false);
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);
  const [pendingCloseReason, setPendingCloseReason] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [isFinalising, setIsFinalising] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  useEffect(() => {
    if (!session?.countsFinalised) return;
    setIsFinalised(true);
    setCounts(countsFromSession(session));
    setCashExpected(session.closingExpected);
    setCashVariance(session.closingVariance);
    if (session.locallyFinalised) {
      setLocalClosingActual(session.closingActual ?? null);
    }
  }, [session]);

  const selectedDenomination = CASH_DENOMINATIONS.find(
    (denomination) => denomination.id === selectedId,
  );
  const cashActual = useMemo(() => {
    if (isFinalised && localClosingActual != null) {
      return Number(localClosingActual) || 0;
    }
    if (isFinalised && session?.closingActual != null) {
      return Number(session.closingActual) || 0;
    }
    return computeActualFromCounts(counts);
  }, [counts, isFinalised, localClosingActual, session?.closingActual]);

  const hasEnteredCount = digits !== "";
  const instruction = selectedDenomination
    ? `Enter total number of ${selectedDenomination.label} in the drawer`
    : "Select an entry on the left";
  const keyClassName =
    "flex aspect-[1.3] items-center justify-center rounded-lg bg-[#ffffff36] text-3xl font-semibold text-gray-900 transition active:scale-95 disabled:opacity-50 sm:text-4xl";

  function appendToken(token) {
    setDigits((prev) => {
      if (token === ".") return prev;
      if (token === "00") {
        if (prev === "" || prev === "0") return "0";
        const next = `${prev}00`;
        return next.length > 6 ? prev : next;
      }
      if (prev === "0") return token;
      const next = `${prev}${token}`;
      return next.length > 6 ? prev : next;
    });
  }

  function addQuickCount(amount) {
    setDigits((prev) => {
      const current = prev === "" ? 0 : Number.parseInt(prev, 10);
      const base = Number.isFinite(current) ? current : 0;
      return String(base + amount);
    });
  }

  function handleKey(key) {
    if (isFinalised || !selectedId) return;
    if (key === "backspace") {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (QUICK_AMOUNTS.has(key)) {
      addQuickCount(Number(key));
      return;
    }
    appendToken(key);
  }

  function handleSelectDenomination(id) {
    if (isFinalised) return;
    setSelectedId(id);
    setDigits(countToDigits(counts[id]));
  }

  function handleSubmit() {
    if (isFinalised || !selectedId) return;
    const count = parseCount(digits);
    setCounts((prev) => ({ ...prev, [selectedId]: count }));
    setDigits("");
  }

  function handleClear() {
    if (isFinalised) return;
    setCounts({});
    setDigits("");
    setSelectedId(null);
  }

  function handleFinaliseClick() {
    setIsConfirmOpen(true);
  }

  async function handleConfirmFinalise() {
    if (isFinalising) return;

    let nextCounts = counts;
    if (selectedId != null && digits !== "") {
      const count = parseCount(digits);
      nextCounts = { ...counts, [selectedId]: count };
      setCounts(nextCounts);
    }

    setIsFinalising(true);
    try {
      if (secondTestOn) {
        const preview = await fetchPosRegisterClosingPreview();
        if (!preview.success) {
          toast.error(preview.error || "Failed to load expected cash");
          return;
        }

        const outboxCashSales = await sumPendingOutboxCashSalesSince(
          session?.openedAt,
        );
        const syncedCashSales = roundMoney(Number(preview.cashSalesTotal) || 0);
        const cashSalesTotal = roundMoney(syncedCashSales + outboxCashSales);
        // Server expected is openingFloat + movements + synced cash only.
        // Add pending outbox cash so local variance matches the drawer.
        const closingExpected = roundMoney(
          (Number(preview.closingExpected) || 0) + outboxCashSales,
        );

        const closingCounts = buildCountsPayload(nextCounts).map((row) => ({
          ...row,
          amount: roundMoney((row.cents * row.count) / 100),
        }));
        const closingActual = roundMoney(computeActualFromCounts(nextCounts));
        const closingVariance = roundMoney(closingActual - closingExpected);

        const localSnapshot = {
          sessionId: String(session?.id || preview.sessionId || ""),
          countsFinalised: true,
          closingCounts,
          closingActual,
          closingExpected,
          closingVariance,
          cashSalesTotal,
          closingVarianceReason: null,
          finalisedAt: new Date().toISOString(),
        };
        await saveLocalRegisterFinalise(localSnapshot);

        const nextSession = {
          ...session,
          countsFinalised: true,
          locallyFinalised: true,
          closingCounts,
          closingActual,
          closingExpected,
          closingVariance,
          cashSalesTotal,
        };

        setIsConfirmOpen(false);
        setIsFinalised(true);
        setLocalClosingActual(closingActual);
        setCashExpected(closingExpected);
        setCashVariance(closingVariance);
        setCounts(countsFromSession(nextSession));
        onSessionUpdated?.(nextSession);
        setRegisterOpen(nextSession);
        toast.success("Counts finalised (local)");
        return;
      }

      const result = await finalisePosRegisterSession({
        counts: buildCountsPayload(nextCounts),
        operator: registerOperatorPayload(activeOperator),
      });
      if (!result.success) {
        toast.error(result.error || "Failed to finalise register");
        return;
      }
      setIsConfirmOpen(false);
      setIsFinalised(true);
      setLocalClosingActual(null);
      setCashExpected(result.session?.closingExpected ?? null);
      setCashVariance(result.session?.closingVariance ?? null);
      if (result.session?.closingCounts?.length) {
        setCounts(countsFromSession(result.session));
      }
      onSessionUpdated?.(result.session);
      setRegisterOpen(result.session);
      toast.success("Counts finalised");
    } finally {
      setIsFinalising(false);
    }
  }

  const hasCashMismatch =
    isFinalised && cashVariance != null && Number(cashVariance) !== 0;

  function openPrintReportPrompt(reason = "") {
    setPendingCloseReason(reason || "");
    setIsMismatchOpen(false);
    setIsPrintReportOpen(true);
  }

  function handleCloseRegisterClick() {
    if (isClosing || isPrintingReport) return;
    if (hasCashMismatch) {
      setVarianceReason("");
      setIsMismatchOpen(true);
      return;
    }
    openPrintReportPrompt();
  }

  async function handleConfirmMismatchClose() {
    const reason = varianceReason.trim();
    if (!reason) {
      toast.error("Please enter a reason for the cash mismatch");
      return;
    }
    openPrintReportPrompt(reason);
  }

  async function resolveSalesTotalsForReport() {
    const preview = await fetchPosRegisterClosingPreview();
    if (!preview.success) {
      return {
        success: false,
        error: preview.error || "Failed to load sales totals",
      };
    }

    let cashTotal = roundMoney(Number(preview.cashSalesTotal) || 0);
    let cardTotal = roundMoney(Number(preview.cardSalesTotal) || 0);

    if (secondTestOn) {
      const since = session?.openedAt || preview.openedAt;
      const [outboxCash, outboxCard] = await Promise.all([
        sumPendingOutboxCashSalesSince(since),
        sumPendingOutboxCardSalesSince(since),
      ]);
      cashTotal = roundMoney(cashTotal + outboxCash);
      cardTotal = roundMoney(cardTotal + outboxCard);
    }

    return {
      success: true,
      cashTotal,
      cardTotal,
      dateLabel: formatSalesReportDate(new Date()),
    };
  }

  async function finishCloseRegister(reason = "") {
    if (secondTestOn) {
      if (reason) {
        await patchLocalRegisterFinalise({
          closingVarianceReason: reason.trim().slice(0, 500),
        });
      }

      const result = await closePosRegisterSessionSecondTest({
        operator: registerOperatorPayload(activeOperator),
      });
      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to close register",
        };
      }
      await clearLocalRegisterFinalise();
      return { success: true };
    }

    const payload = {
      operator: registerOperatorPayload(activeOperator),
    };
    if (reason) payload.varianceReason = reason;

    const result = await closePosRegisterSession(payload);
    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to close register",
      };
    }
    return { success: true };
  }

  function afterRegisterClosed() {
    setIsPrintReportOpen(false);
    setIsMismatchOpen(false);
    toast.success("Register closed");
    setRegisterClosed();
    if (pinLockEnabled) {
      lock();
      return;
    }
    router.push(posHomePath);
  }

  async function handleSkipPrintAndClose() {
    if (isClosing || isPrintingReport) return;
    setIsClosing(true);
    try {
      const result = await finishCloseRegister(pendingCloseReason);
      if (!result.success) {
        toast.error(result.error || "Failed to close register");
        return;
      }
      afterRegisterClosed();
    } finally {
      setIsClosing(false);
    }
  }

  async function handlePrintReportAndClose() {
    if (isClosing || isPrintingReport) return;
    setIsPrintingReport(true);
    try {
      const totals = await resolveSalesTotalsForReport();
      if (!totals.success) {
        toast.error(totals.error || "Failed to load sales totals");
        return;
      }

      const printResult = await printSalesReportReceipt({
        storeName: storeProfile?.storeName || "",
        dateLabel: totals.dateLabel,
        cashTotal: totals.cashTotal,
        cardTotal: totals.cardTotal,
      });
      if (!printResult.success) {
        toast.error(printResult.message || "Failed to print sales report");
        return;
      }

      setIsClosing(true);
      const result = await finishCloseRegister(pendingCloseReason);
      if (!result.success) {
        toast.error(result.error || "Failed to close register");
        return;
      }
      afterRegisterClosed();
    } finally {
      setIsPrintingReport(false);
      setIsClosing(false);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4 min-[960px]:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
          <div className="grid grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr] bg-neutral-200 px-4 py-2.5 text-sm font-bold text-neutral-900">
            <span>Tender Type</span>
            <span className="text-right">Expected</span>
            <span className="text-right">Variance</span>
            <span className="text-right">Actual</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr] items-center border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
              <span>Cash</span>
              <span className="text-right tabular-nums">
                {isFinalised && cashExpected != null
                  ? formatMoney(cashExpected)
                  : ""}
              </span>
              <span
                className={cn(
                  "text-right tabular-nums",
                  isFinalised &&
                    cashVariance != null &&
                    cashVariance !== 0 &&
                    "text-red-600",
                )}
              >
                {isFinalised && cashVariance != null
                  ? formatMoney(cashVariance)
                  : ""}
              </span>
              <span className="text-right tabular-nums">
                {formatMoney(cashActual)}
              </span>
            </div>

            {CASH_DENOMINATIONS.map((denomination) => {
              const isSelected = selectedId === denomination.id;
              const count = counts[denomination.id];
              const hasCount = count != null;
              const actual = denominationAmount(denomination, count);

              return (
                <button
                  key={denomination.id}
                  type="button"
                  onClick={() => handleSelectDenomination(denomination.id)}
                  disabled={isFinalised}
                  aria-pressed={isSelected}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr] items-center border-b border-neutral-200 px-4 py-2.5 text-left text-sm transition-colors",
                    isFinalised
                      ? "cursor-default"
                      : isSelected
                        ? "bg-brand_accent/10"
                        : "hover:bg-neutral-50",
                  )}
                >
                  <span
                    className={cn(
                      "pl-6",
                      isSelected
                        ? "font-semibold text-neutral-900"
                        : "text-neutral-700",
                    )}
                  >
                    {denomination.label}
                  </span>
                  <span className="col-span-2 text-left text-neutral-700">
                    {hasCount ? `Quantity: ${count}` : ""}
                  </span>
                  <span className="text-right tabular-nums text-neutral-900">
                    {hasCount ? formatMoney(actual) : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={cn(
              "grid shrink-0 gap-3 p-4",
              isFinalised ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {isFinalised ? (
              <button
                type="button"
                onClick={handleCloseRegisterClick}
                disabled={isClosing}
                className="flex min-h-[3.5rem] items-center justify-center rounded-md bg-brand_accent text-base font-bold uppercase tracking-wide text-white transition active:scale-[0.99] disabled:opacity-50"
              >
                {isClosing ? "Closing…" : "Close Register"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex min-h-[3.5rem] items-center justify-center rounded-md bg-[#ef3636] text-base font-bold uppercase tracking-wide text-white transition active:scale-[0.99]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleFinaliseClick}
                  className="flex min-h-[3.5rem] items-center justify-center rounded-md bg-[#2563eb] text-base font-bold uppercase tracking-wide text-white transition active:scale-[0.99]"
                >
                  Finalise
                </button>
              </>
            )}
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-sm shrink-0 flex-col justify-start min-[960px]:mx-0">
          <div className="rounded-3xl bg-white/[0.06] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:p-6">
            <p className="mb-4 flex min-h-[3rem] items-center justify-center text-center text-base leading-snug text-white/70">
              {isFinalised
                ? "Counts are locked. Close the register to finish."
                : instruction}
            </p>
            <div
              className={cn(
                "mb-5 flex h-16 items-center justify-center rounded-lg bg-[#ffffff5c] px-4 text-3xl font-semibold tabular-nums tracking-wide sm:text-4xl",
                hasEnteredCount ? "text-gray-900" : "text-white/40",
              )}
            >
              {formatCountDisplay(digits)}
            </div>

            <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
              {KEYPAD_ROWS.flat().map((key) => {
                if (key === "backspace") {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKey(key)}
                      disabled={isFinalised || !selectedId}
                      className={keyClassName}
                      aria-label="Delete"
                    >
                      <Delete className="size-7 sm:size-8" strokeWidth={2} />
                    </button>
                  );
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKey(key)}
                    disabled={isFinalised || !selectedId}
                    className={cn(
                      keyClassName,
                      QUICK_AMOUNTS.has(key) && "text-2xl sm:text-3xl",
                    )}
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isFinalised || !selectedId}
              className="mt-5 flex min-h-[3.5rem] w-full items-center justify-center rounded-lg bg-brand_accent text-base font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </section>
      </div>

      <dialog className={`modal ${isConfirmOpen ? "modal-open" : ""}`}>
        <div className="modal-box w-[400px] max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">
              Confirm finalise
            </h3>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isFinalising}
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-2 text-sm text-neutral-600">
            Are you sure the amount is correct? You won&apos;t be able to change
            it later.
          </p>
          <div className="mb-6 rounded-lg bg-neutral-100 p-4 text-center">
            <p className="text-sm font-medium text-neutral-500">Cash actual</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
              {formatMoney(cashActual)}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isFinalising}
              className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmFinalise}
              disabled={isFinalising}
              className="flex-1 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {isFinalising ? "Finalising…" : "Confirm"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            type="submit"
            onClick={() => setIsConfirmOpen(false)}
            disabled={isFinalising}
          >
            close
          </button>
        </form>
      </dialog>

      <dialog className={`modal ${isMismatchOpen ? "modal-open" : ""}`}>
        <div className="modal-box w-[440px] max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">
              Cash mismatch
            </h3>
            <button
              type="button"
              onClick={() => setIsMismatchOpen(false)}
              disabled={isClosing}
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-4 text-sm text-neutral-700">
            The amount of reported cash in register does not match the system.
          </p>

          <div className="mb-4 space-y-2 rounded-lg bg-neutral-100 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">System expected</span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {formatMoney(cashExpected)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-500">Reported actual</span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {formatMoney(cashActual)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-2">
              <span className="text-neutral-500">Variance</span>
              <span className="font-semibold tabular-nums text-red-600">
                {formatMoney(cashVariance)}
              </span>
            </div>
          </div>

          <label className="mb-6 block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-700">
              Reason for mismatch
            </span>
            <textarea
              value={varianceReason}
              onChange={(event) => setVarianceReason(event.target.value)}
              disabled={isClosing}
              rows={3}
              maxLength={500}
              placeholder="Enter why the cash amounts do not match"
              className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-brand_accent focus:ring-2 focus:ring-brand_accent/20 disabled:opacity-50"
            />
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsMismatchOpen(false)}
              disabled={isClosing}
              className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmMismatchClose}
              disabled={isClosing || isPrintingReport || !varianceReason.trim()}
              className="flex-1 rounded-xl bg-brand_accent px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            type="submit"
            onClick={() => setIsMismatchOpen(false)}
            disabled={isClosing || isPrintingReport}
          >
            close
          </button>
        </form>
      </dialog>

      <dialog className={`modal ${isPrintReportOpen ? "modal-open" : ""}`}>
        <div className="modal-box w-[400px] max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">
              Print sales report?
            </h3>
            <button
              type="button"
              onClick={() => setIsPrintReportOpen(false)}
              disabled={isClosing || isPrintingReport}
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-6 text-sm text-neutral-700">
            Do you want to print the sales report before closing the register?
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSkipPrintAndClose}
              disabled={isClosing || isPrintingReport}
              className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              {isClosing && !isPrintingReport ? "Closing…" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handlePrintReportAndClose}
              disabled={isClosing || isPrintingReport}
              className="flex-1 rounded-xl bg-brand_accent px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {isPrintingReport ? "Printing…" : "Print"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            type="submit"
            onClick={() => setIsPrintReportOpen(false)}
            disabled={isClosing || isPrintingReport}
          >
            close
          </button>
        </form>
      </dialog>
    </>
  );
}
