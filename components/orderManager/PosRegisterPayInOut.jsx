"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/helper";
import { addPosRegisterMovement } from "@/lib/api/fetchApi";
import { registerOperatorPayload } from "@/lib/pos/registerOperatorPayload";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import SideDrawer from "./SideDrawer";

const KEYPAD_ROWS = [
  ["1", "2", "3", "backspace"],
  ["4", "5", "6", "10"],
  ["7", "8", "9", "20"],
  ["0", "00", ".", "50"],
];

const QUICK_AMOUNTS = new Set(["10", "20", "50"]);

function formatAmountDisplay(value) {
  if (value === "" || value == null) return "$ 0.00";
  const normalized = String(value).replace(/^\$\s*/, "");
  if (normalized === "" || normalized === ".") return "$ 0.";
  return `$ ${normalized}`;
}

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function parseAmount(digits) {
  if (digits === "" || digits == null) return 0;
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Cash Pay In/Out — amount keypad, then comment drawer.
 */
export default function PosRegisterPayInOut({
  session,
  onSessionUpdated,
}) {
  const { activeOperator } = useActiveOperator();
  const [digits, setDigits] = useState("");
  const [drawerType, setDrawerType] = useState(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDrawerOpen = drawerType != null;
  const amount = parseAmount(digits);
  const isPayIn = drawerType === "pay-in";
  const countsFinalised = Boolean(session?.countsFinalised);

  useEffect(() => {
    if (!isDrawerOpen) setComment("");
  }, [isDrawerOpen]);

  function appendToken(token) {
    setDigits((prev) => {
      if (token === ".") {
        if (prev.includes(".")) return prev;
        return prev === "" ? "0." : `${prev}.`;
      }
      if (token === "00") {
        if (prev === "" || prev === "0") return "0";
        const [, decimals = ""] = prev.split(".");
        if (prev.includes(".") && decimals.length >= 2) return prev;
        if (prev.includes(".") && decimals.length === 1) return `${prev}0`;
        return `${prev}00`;
      }
      if (prev.includes(".")) {
        const [, decimals = ""] = prev.split(".");
        if (decimals.length >= 2) return prev;
      }
      if (prev === "0" && token !== ".") return token;
      const next = `${prev}${token}`;
      return next.length > 10 ? prev : next;
    });
  }

  function addQuickAmount(amountToAdd) {
    setDigits((prev) => {
      const current = prev === "" ? 0 : Number.parseFloat(prev);
      const base = Number.isFinite(current) ? current : 0;
      const next = Math.round((base + amountToAdd) * 100) / 100;
      return String(next);
    });
  }

  function handleKey(key) {
    if (countsFinalised || isSubmitting) return;
    if (key === "backspace") {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (QUICK_AMOUNTS.has(key)) {
      addQuickAmount(Number(key));
      return;
    }
    appendToken(key);
  }

  function handleOpenDrawer(type) {
    if (countsFinalised) return;
    if (parseAmount(digits) <= 0) {
      toast.error("Enter an amount first");
      return;
    }
    setDrawerType(type);
  }

  function handleCloseDrawer() {
    if (isSubmitting) return;
    setDrawerType(null);
  }

  async function handleSubmit() {
    if (isSubmitting || !drawerType) return;
    if (amount <= 0) {
      toast.error("Enter an amount first");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addPosRegisterMovement({
        type: drawerType,
        amount,
        comment: comment.trim(),
        operator: registerOperatorPayload(activeOperator),
      });
      if (!result.success) {
        toast.error(result.error || "Failed to record movement");
        return;
      }
      onSessionUpdated?.(result.session);
      setDrawerType(null);
      setDigits("");
      toast.success(isPayIn ? "Cash pay-in recorded" : "Cash pay-out recorded");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasEnteredAmount = digits !== "";
  const keyClassName =
    "flex aspect-[1.3] items-center justify-center rounded-lg bg-[#ffffff36] text-3xl font-semibold text-gray-900 transition active:scale-95 disabled:opacity-50 sm:text-4xl";

  return (
    <>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 pb-4">
        <div className="w-full max-w-sm rounded-3xl bg-white/[0.06] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:p-6">
          <div
            className={cn(
              "mb-5 flex h-16 items-center justify-center rounded-lg bg-[#ffffff5c] px-4 text-3xl font-semibold tabular-nums tracking-wide sm:text-4xl",
              hasEnteredAmount ? "text-gray-900" : "text-white/40",
            )}
          >
            {formatAmountDisplay(digits)}
          </div>

          <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            {KEYPAD_ROWS.flat().map((key) => {
              if (key === "backspace") {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKey(key)}
                    disabled={countsFinalised || isSubmitting}
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
                  disabled={countsFinalised || isSubmitting}
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

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => handleOpenDrawer("pay-in")}
              disabled={countsFinalised || isSubmitting}
              className="flex min-h-[3.5rem] items-center justify-center rounded-lg bg-[#42ecaf] px-3 text-base font-semibold text-[#0f583e] shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              Cash Pay In
            </button>
            <button
              type="button"
              onClick={() => handleOpenDrawer("pay-out")}
              disabled={countsFinalised || isSubmitting}
              className="flex min-h-[3.5rem] items-center justify-center rounded-lg bg-[#ef3636] px-3 text-base font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              Cash Pay Out
            </button>
          </div>
        </div>
      </div>

      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={isPayIn ? "Cash Pay In" : "Cash Pay Out"}
        subtitle={`Amount: ${formatMoney(amount)}`}
        closeDisabled={isSubmitting}
        contentKey="pos-register-pay-in-out-drawer"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCloseDrawer}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                "flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50",
                isPayIn
                  ? "bg-[#16a34a] hover:bg-[#15803d]"
                  : "bg-[#ef3636] hover:bg-[#e0662e]",
              )}
            >
              {isSubmitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-sm font-semibold text-neutral-700">Comment</p>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={isSubmitting}
          rows={5}
          placeholder={
            isPayIn
              ? "Why is cash being paid in?"
              : "Why is cash being paid out?"
          }
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none ring-0 focus:border-neutral-500 disabled:opacity-50"
        />
      </SideDrawer>
    </>
  );
}
