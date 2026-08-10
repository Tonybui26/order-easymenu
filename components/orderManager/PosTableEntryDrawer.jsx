"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { motion } from "motion/react";
import SideDrawer from "./SideDrawer";

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
    setIsNumberMissing(false);
    setDigits((prev) => {
      if (digit === ".") {
        if (prev.includes(".")) return prev;
        return `${prev}.`;
      }
      const next = `${prev}${digit}`;
      const maxLen = isQuantityMode ? 4 : 6;
      return next.length > maxLen ? prev : next;
    });
  }

  function handleKey(key) {
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
    const quantity = Number.parseInt(resolvedDigits(), 10);
    onConfirm?.({
      quantity: Number.isFinite(quantity) ? quantity : 0,
    });
    onClose?.();
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      side="left"
      zIndex={40}
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
            <span className="text-neutral-300">{String(initialNumber)}</span>
          ) : (
            <span
              className={
                isNumberMissing
                  ? "text-lg font-semibold text-red-400"
                  : "text-neutral-300"
              }
            >
              {isNumberMissing ? "Enter table number" : "\u00A0"}
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
                className="flex h-16 items-center justify-center rounded-md bg-white text-xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95"
              >
                {key}
              </button>
            );
          })}
        </div>

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
