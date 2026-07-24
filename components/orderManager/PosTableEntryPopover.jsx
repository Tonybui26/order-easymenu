"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/helper";

const KEYPAD_ROWS = [
  ["1", "2", "3", "0"],
  ["4", "5", "6", "backspace"],
  ["7", "8", "9", "reset"],
];

const ORDER_TYPES = [
  { id: "dine-in", label: "DINE IN" },
  // { id: "buzzer", label: "BUZZER" },
  { id: "takeaway", label: "TAKEAWAY" },
  // { id: "delivery", label: "DELIVERY" },
];

/**
 * Table / buzzer number entry popover for POS.
 * Brand accent background; selecting an order type confirms the entry.
 */
export default function PosTableEntryPopover({
  isOpen,
  onClose,
  initialNumber = "",
  onConfirm,
}) {
  const [digits, setDigits] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setDigits(initialNumber ? String(initialNumber) : "");
  }, [isOpen, initialNumber]);

  function appendDigit(digit) {
    setDigits((prev) => {
      const next = `${prev}${digit}`;
      return next.length > 6 ? prev : next;
    });
  }

  function handleKey(key) {
    if (key === "backspace") {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "reset") {
      setDigits("");
      return;
    }
    appendDigit(key);
  }

  function handleSelectOrderType(orderTypeId) {
    onConfirm?.({
      number: digits,
      orderType: orderTypeId,
    });
    onClose?.();
  }

  return (
    <>
      <AnimatePresence>
        {isOpen ? (
          <motion.button
            key="pos-table-backdrop"
            type="button"
            aria-label="Close table entry"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="pos-table-popover"
            className="absolute left-1/2 top-full z-50 mt-3 w-[min(100%,22rem)]"
            initial={{ opacity: 0, x: "-50%", y: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
            exit={{ opacity: 0, x: "-50%", y: -6, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Arrow */}
            <div
              aria-hidden
              className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 -translate-y-full border-x-[10px] border-b-[12px] border-x-transparent border-b-[#ec7439]"
            />
            <div className="overflow-hidden rounded-2xl bg-[#ec7439] p-4 shadow-2xl">
              <p className="mb-3 text-center text-base font-semibold text-white">
                Enter Number
              </p>

              <div className="mb-3 flex min-h-[3.25rem] items-center justify-center rounded-lg bg-white px-4 text-3xl font-bold tabular-nums text-neutral-900">
                {digits || <span className="text-neutral-300">&nbsp;</span>}
              </div>

              <div className="mb-3 grid grid-cols-4 gap-2">
                {KEYPAD_ROWS.flat().map((key) => {
                  if (key === "backspace") {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKey(key)}
                        className="flex aspect-square items-center justify-center rounded-lg bg-white text-neutral-800 shadow-sm transition-transform active:scale-95"
                        aria-label="Delete"
                      >
                        <Delete size={22} strokeWidth={2.25} />
                      </button>
                    );
                  }
                  if (key === "reset") {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKey(key)}
                        className="flex aspect-square items-center justify-center rounded-lg bg-neutral-800 text-xs font-bold tracking-wide text-white shadow-sm transition-transform active:scale-95"
                      >
                        RESET
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKey(key)}
                      className="flex aspect-square items-center justify-center rounded-lg bg-white text-2xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/40">
                {ORDER_TYPES.map((type, index) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleSelectOrderType(type.id)}
                    className={cn(
                      "min-h-[3.25rem] px-2 text-sm font-bold tracking-wide text-white transition-colors hover:bg-white/10 active:bg-white/20",
                      index % 2 === 0 && "border-r border-white/40",
                      index < 2 && "border-b border-white/40",
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
