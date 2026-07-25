"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [portalReady, setPortalReady] = useState(false);
  const isQuantityMode = mode === "quantity";
  const title = MODE_TITLES[mode] || MODE_TITLES.table;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setDigits(initialNumber ? String(initialNumber) : "");
  }, [isOpen, initialNumber]);

  function appendDigit(digit) {
    setDigits((prev) => {
      const next = `${prev}${digit}`;
      const maxLen = isQuantityMode ? 3 : 6;
      return next.length > maxLen ? prev : next;
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

  function handleConfirmQuantity() {
    const quantity = Number.parseInt(digits, 10);
    onConfirm?.({
      quantity: Number.isFinite(quantity) ? quantity : 0,
    });
    onClose?.();
  }

  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.button
          key="pos-table-backdrop"
          type="button"
          aria-label="Close keypad"
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      ) : null}

      {isOpen ? (
        <motion.aside
          key="pos-table-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(100%,22rem)] flex-col bg-[#ec7439] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] shadow-2xl"
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <p className="mb-3 text-center text-base font-semibold text-white">
              {title}
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

            {isQuantityMode ? (
              <button
                type="button"
                onClick={handleConfirmQuantity}
                className="min-h-[3.25rem] rounded-lg border border-white/40 text-sm font-bold tracking-wide text-white transition-colors hover:bg-white/10 active:bg-white/20"
              >
                DONE
              </button>
            ) : (
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
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
