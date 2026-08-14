"use client";

import { useMemo, useState } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/helper";

const KEYPAD_ROWS = [
  ["1", "2", "3", "backspace"],
  ["4", "5", "6", "10"],
  ["7", "8", "9", "20"],
  ["0", "00", ".", "50"],
];

const QUICK_AMOUNTS = new Set(["10", "20", "50"]);

const CASH_DENOMINATIONS = [
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

/**
 * Close Register — denomination counts on the left, count keypad on the right (UI only).
 */
export default function PosRegisterClose() {
  const [counts, setCounts] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [digits, setDigits] = useState("");
  const [isFinalised, setIsFinalised] = useState(false);

  const selectedDenomination = CASH_DENOMINATIONS.find(
    (denomination) => denomination.id === selectedId,
  );
  const cashActual = useMemo(
    () =>
      CASH_DENOMINATIONS.reduce(
        (sum, denomination) =>
          sum + denominationAmount(denomination, counts[denomination.id]),
        0,
      ),
    [counts],
  );
  const cashExpected = 0;
  const cashVariance = cashActual - cashExpected;
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
    if (!selectedId) return;
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
    setSelectedId(id);
    setDigits(countToDigits(counts[id]));
  }

  function handleSubmit() {
    if (!selectedId) return;
    const count = parseCount(digits);
    setCounts((prev) => ({ ...prev, [selectedId]: count }));
    setDigits("");
  }

  function handleClear() {
    setCounts({});
    setDigits("");
    setSelectedId(null);
    setIsFinalised(false);
  }

  function handleFinalise() {
    setIsFinalised(true);
  }

  return (
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
              {isFinalised ? formatMoney(cashExpected) : ""}
            </span>
            <span
              className={cn(
                "text-right tabular-nums",
                isFinalised && cashVariance !== 0 && "text-red-600",
              )}
            >
              {isFinalised ? formatMoney(cashVariance) : ""}
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
                aria-pressed={isSelected}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr] items-center border-b border-neutral-200 px-4 py-2.5 text-left text-sm transition-colors",
                  isSelected ? "bg-brand_accent/10" : "hover:bg-neutral-50",
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

        <div className="grid shrink-0 grid-cols-2 gap-3 p-4">
          <button
            type="button"
            onClick={handleClear}
            className="flex min-h-[3.5rem] items-center justify-center rounded-md bg-[#ef3636] text-base font-bold uppercase tracking-wide text-white transition active:scale-[0.99]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleFinalise}
            className="flex min-h-[3.5rem] items-center justify-center rounded-md bg-[#2563eb] text-base font-bold uppercase tracking-wide text-white transition active:scale-[0.99]"
          >
            Finalise
          </button>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-sm shrink-0 flex-col justify-start min-[960px]:mx-0">
        <div className="rounded-3xl bg-white/[0.06] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:p-6">
          <p className="mb-4 flex min-h-[3rem] items-center justify-center text-center text-base leading-snug text-white/70">
            {instruction}
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
                    disabled={!selectedId}
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
                  disabled={!selectedId}
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
            disabled={!selectedId}
            className="mt-5 flex min-h-[3.5rem] w-full items-center justify-center rounded-lg bg-brand_accent text-base font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </section>
    </div>
  );
}
