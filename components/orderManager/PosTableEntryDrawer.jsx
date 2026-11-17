"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import SideDrawer from "./SideDrawer";

/** POS cart only — matches easymenu `POS_MIN_LINE_QUANTITY`. */
const POS_MIN_QTY = 0.01;
const POS_MAX_QTY = 999;

function roundPosQty(value) {
  const parsed = Number.parseFloat(String(value).trim());
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

function formatQtyDisplay(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["0", ".", "backspace"],
];

const ORDER_TYPES = [
  { id: "dine-in", label: "DINE IN" },
  // { id: "buzzer", label: "BUZZER" },
  { id: "takeaway", label: "TAKEAWAY" },
  // { id: "delivery", label: "DELIVERY" },
];

const MODE_TITLES = {
  table: "Enter Number",
  quantity: "Quantity",
};

/**
 * Shared POS keypad drawer (table number or line quantity).
 * Slides in from the left.
 */
export default function PosTableEntryDrawer({
  isOpen,
  onClose,
  mode = "table",
  initialNumber = "",
  disableNumberInput = false,
  onConfirm,
}) {
  const [digits, setDigits] = useState("");
  const [isNumberMissing, setIsNumberMissing] = useState(false);
  const [numberFieldShakeKey, setNumberFieldShakeKey] = useState(0);
  const isQuantityMode = mode === "quantity";
  const title = MODE_TITLES[mode] || MODE_TITLES.table;

  useEffect(() => {
    if (!isOpen) return;
    // Start blank so the current value is only a placeholder; typing replaces it.
    setDigits("");
    setIsNumberMissing(false);
  }, [isOpen, initialNumber]);

  function appendDigit(digit) {
    if (disableNumberInput) return;
    setIsNumberMissing(false);
    setDigits((prev) => {
      if (digit === ".") {
        if (!isQuantityMode || prev.includes(".")) return prev;
        return prev === "" ? "0." : `${prev}.`;
      }
      if (isQuantityMode && prev.includes(".")) {
        const [, decimals = ""] = prev.split(".");
        if (decimals.length >= 2) return prev;
      }
      const next = `${prev}${digit}`;
      const maxLen = isQuantityMode ? 6 : 6;
      return next.length > maxLen ? prev : next;
    });
  }

  function handleKey(key) {
    if (disableNumberInput) return;
    if (key === "backspace") {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    appendDigit(key);
  }

  function resolvedDigits() {
    return digits === "" ? String(initialNumber || "") : digits;
  }

  function hasEnteredNumber() {
    return String(resolvedDigits()).trim() !== "";
  }

  function nudgeMissingNumber() {
    setIsNumberMissing(true);
    setNumberFieldShakeKey((key) => key + 1);
  }

  function handleSelectOrderType(orderTypeId) {
    const requiresNumber =
      orderTypeId === "dine-in" || orderTypeId === "buzzer";
    if (requiresNumber && !hasEnteredNumber()) {
      nudgeMissingNumber();
      return;
    }

    onConfirm?.({
      number: resolvedDigits(),
      orderType: orderTypeId,
    });
    onClose?.();
  }

  function handleConfirmQuantity() {
    const quantity = roundPosQty(resolvedDigits());
    if (quantity == null || quantity < POS_MIN_QTY || quantity > POS_MAX_QTY) {
      nudgeMissingNumber();
      toast.error(
        `Enter a quantity between ${POS_MIN_QTY} and ${POS_MAX_QTY}`,
      );
      return;
    }
    onConfirm?.({ quantity });
    onClose?.();
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      side="left"
      widthClassName="w-[min(100%,22rem)]"
      panelClassName="bg-[#984B28]"
      bodyClassName=""
      contentKey="pos-table-drawer"
      ariaLabel={title}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <p className="mb-3 text-center text-base font-semibold text-white">
          {title}
        </p>

        <motion.div
          key={numberFieldShakeKey}
          initial={{ x: 0 }}
          animate={
            numberFieldShakeKey > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }
          }
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className={`mb-3 flex min-h-[3.25rem] items-center justify-center rounded-lg bg-white px-4 text-3xl font-bold tabular-nums text-neutral-900 ${
            isNumberMissing
              ? "bg-red-50 text-red-700 shadow-[0_0_0_2px_#ef4444]"
              : ""
          }`}
        >
          {digits ? (
            digits
          ) : initialNumber ? (
            <span className="text-neutral-300">
              {isQuantityMode
                ? formatQtyDisplay(initialNumber)
                : String(initialNumber)}
            </span>
          ) : (
            <span
              className={
                isNumberMissing
                  ? "text-lg font-semibold text-red-400"
                  : "text-neutral-300"
              }
            >
              {isNumberMissing
                ? isQuantityMode
                  ? "Enter quantity"
                  : "Enter table number"
                : "\u00A0"}
            </span>
          )}
        </motion.div>

        {!isQuantityMode ? (
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {ORDER_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => handleSelectOrderType(type.id)}
                className="min-h-[3.25rem] rounded-lg bg-[#ec7439] px-2 text-sm font-bold tracking-wide text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
              >
                {type.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {KEYPAD_ROWS.flat().map((key) => {
            if (key === "backspace") {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disableNumberInput}
                  onClick={() => handleKey(key)}
                  className="flex h-16 items-center justify-center rounded-md bg-white text-neutral-800 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
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
                disabled={disableNumberInput}
                onClick={() => handleKey(key)}
                className="flex h-16 items-center justify-center rounded-md bg-white text-xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
              >
                {key}
              </button>
            );
          })}
        </div>

        {!isQuantityMode && disableNumberInput ? (
          <p className="mb-3 text-center text-xs font-medium text-white/75">
            Table number is locked from the table map.
          </p>
        ) : null}

        {isQuantityMode ? (
          <button
            type="button"
            onClick={handleConfirmQuantity}
            className="min-h-[3.25rem] rounded-lg border border-white/40 text-sm font-bold tracking-wide text-white transition-colors hover:bg-white/10 active:bg-white/20"
          >
            DONE
          </button>
        ) : null}
      </div>
    </SideDrawer>
  );
}
