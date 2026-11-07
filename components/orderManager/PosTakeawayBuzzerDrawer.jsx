"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { motion } from "motion/react";
import SideDrawer from "./SideDrawer";

const KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "",
  "0",
  "backspace",
];

/**
 * Number pad for a takeaway buzzer. Continue starts the order.
 */
export default function PosTakeawayBuzzerDrawer({
  isOpen,
  onCancel,
  onConfirm,
}) {
  const [digits, setDigits] = useState("");
  const [isMissing, setIsMissing] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setDigits("");
    setIsMissing(false);
  }, [isOpen]);

  function appendDigit(digit) {
    setIsMissing(false);
    setDigits((prev) => (prev.length >= 6 ? prev : `${prev}${digit}`));
  }

  function handleKey(key) {
    if (key === "backspace") {
      setIsMissing(false);
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    appendDigit(key);
  }

  function handleContinue() {
    const number = digits.trim();
    if (!number) {
      setIsMissing(true);
      setShakeKey((key) => key + 1);
      return;
    }
    onConfirm?.(number);
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={undefined}
      showCloseButton={false}
      showHeader={false}
      side="left"
      widthClassName="w-[min(100%,22rem)]"
      panelClassName="bg-[#984B28]"
      bodyClassName=""
      contentKey="pos-takeaway-buzzer"
      ariaLabel="Buzzer"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <p className="mb-3 text-center text-base font-semibold text-white">
          Buzzer
        </p>

        <motion.div
          key={shakeKey}
          initial={{ x: 0 }}
          animate={shakeKey > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className={`mb-3 flex min-h-[3.25rem] items-center justify-center rounded-lg px-4 text-3xl font-bold tabular-nums ${
            isMissing
              ? "bg-red-50 text-red-700 shadow-[0_0_0_2px_#ef4444]"
              : "bg-white text-neutral-900"
          }`}
        >
          {digits ? (
            digits
          ) : (
            <span
              className={
                isMissing
                  ? "text-lg font-semibold text-red-400"
                  : "text-lg font-semibold text-neutral-300"
              }
            >
              {isMissing ? "Enter buzzer number" : "Buzzer number"}
            </span>
          )}
        </motion.div>

        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {KEYS.map((key) => {
            if (!key) return <span key="spacer" />;
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

        <div className="mt-auto grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.25rem] rounded-lg border border-white/40 text-sm font-bold tracking-wide text-white transition-colors hover:bg-white/10 active:bg-white/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="min-h-[3.25rem] rounded-lg bg-white text-sm font-bold tracking-wide text-[#984B28] transition-colors hover:bg-neutral-100 active:bg-neutral-200"
          >
            Continue
          </button>
        </div>
      </div>
    </SideDrawer>
  );
}
