"use client";

import { useEffect, useState } from "react";
import { Delete, DollarSign, Percent } from "lucide-react";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import { cn } from "@/lib/helper";
import SideDrawer from "./SideDrawer";

const KEYPAD_ROWS = [
  ["1", "2", "3", "backspace"],
  ["4", "5", "6", "10"],
  ["7", "8", "9", "20"],
  ["0", "00", ".", "50"],
];

const QUICK_AMOUNTS = new Set(["10", "20", "50"]);

const DISCOUNT_ACTIONS = [
  {
    id: "percent",
    label: "% Discount",
    Icon: Percent,
    className:
      "bg-[#e1baff] text-[#362864] hover:bg-[#d4a8f5] active:bg-[#c796eb]",
  },
  {
    id: "dollar",
    label: "$ Discount",
    Icon: DollarSign,
    className:
      "bg-[#42ecaf] text-[#0f583e] hover:bg-[#36d49c] active:bg-[#2db888]",
  },
];

function formatEntryDisplay(value) {
  if (value === "" || value == null) return "\u00A0";
  return String(value);
}

function parseEntryValue(digits) {
  if (digits === "" || digits == null) return null;
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Left-side discount drawer — shared money keypad with % or $ apply actions.
 */
export default function PosDiscountDrawer({
  isOpen,
  onClose,
  subtotal = 0,
  initialDigits = "",
  onConfirm,
}) {
  const [digits, setDigits] = useState("");
  const [isValueMissing, setIsValueMissing] = useState(false);
  const [valueFieldShakeKey, setValueFieldShakeKey] = useState(0);
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);

  useEffect(() => {
    if (!isOpen) return;
    setDigits("");
    setIsValueMissing(false);
  }, [isOpen, initialDigits]);

  function appendToken(token) {
    setIsValueMissing(false);
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
    setIsValueMissing(false);
    setDigits((prev) => {
      const current = prev === "" ? 0 : Number.parseFloat(prev);
      const base = Number.isFinite(current) ? current : 0;
      const next = Math.round((base + amountToAdd) * 100) / 100;
      return String(next);
    });
  }

  function handleKey(key) {
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

  function resolvedDigits() {
    return digits === "" ? String(initialDigits || "") : digits;
  }

  function resolvedValue() {
    return parseEntryValue(resolvedDigits());
  }

  function nudgeMissingValue() {
    setIsValueMissing(true);
    setValueFieldShakeKey((key) => key + 1);
  }

  function handleApply(type) {
    const value = resolvedValue();
    if (value == null) {
      nudgeMissingValue();
      toast.error("Enter a discount amount first");
      return;
    }

    if (value === 0) {
      onConfirm?.({ discountAmount: 0 });
      onClose?.();
      return;
    }

    if (type === "percent") {
      if (value > 100) {
        toast.error("Discount cannot exceed 100%");
        return;
      }
      const discountAmount =
        Math.round(((safeSubtotal * value) / 100) * 100) / 100;
      onConfirm?.({
        discountAmount,
        discountPercent: value,
        discountType: "percent",
      });
      onClose?.();
      return;
    }

    if (value > safeSubtotal) {
      toast.error("Discount cannot exceed the subtotal");
      return;
    }

    const discountAmount = Math.round(value * 100) / 100;

    onConfirm?.({
      discountAmount,
      discountType: "dollar",
    });
    onClose?.();
  }

  const hasTypedDigits = digits !== "";
  const placeholderDigits = initialDigits ? String(initialDigits) : "";

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      side="left"
      widthClassName="w-[min(100%,22rem)]"
      panelClassName="bg-[#984B28]"
      bodyClassName=""
      contentKey="pos-discount-drawer"
      ariaLabel="Discount"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <p className="mb-3 text-center text-base font-semibold text-white">
          Discount
        </p>

        <motion.div
          key={valueFieldShakeKey}
          initial={{ x: 0 }}
          animate={
            valueFieldShakeKey > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }
          }
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className={cn(
            "mb-4 flex min-h-[3.25rem] items-center justify-center rounded-lg bg-white px-4 text-3xl font-bold tabular-nums text-neutral-900",
            isValueMissing && "bg-red-50 text-red-700 shadow-[0_0_0_2px_#ef4444]",
          )}
        >
          {hasTypedDigits ? (
            formatEntryDisplay(digits)
          ) : placeholderDigits ? (
            <span className="text-neutral-300">{placeholderDigits}</span>
          ) : (
            <span
              className={cn(
                isValueMissing
                  ? "text-lg font-semibold text-red-400"
                  : "text-neutral-300",
              )}
            >
              {isValueMissing ? "Enter discount" : "\u00A0"}
            </span>
          )}
        </motion.div>

        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {KEYPAD_ROWS.flat().map((key) => {
            if (key === "backspace") {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKey(key)}
                  className="flex h-16 items-center justify-center rounded-md bg-white text-neutral-800 shadow-sm transition-transform active:scale-95"
                  aria-label="Delete"
                >
                  <Delete size={18} strokeWidth={2.25} />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleKey(key)}
                className={cn(
                  "flex h-16 items-center justify-center rounded-md bg-white text-xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95",
                  QUICK_AMOUNTS.has(key) && "text-lg",
                )}
              >
                {key}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {DISCOUNT_ACTIONS.map(({ id, label, Icon, className }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleApply(id)}
              className={cn(
                "flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wide shadow-sm transition-colors",
                className,
              )}
            >
              <Icon size={28} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </SideDrawer>
  );
}
