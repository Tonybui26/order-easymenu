"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, CreditCard, Delete, HandCoins } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/helper";

const KEYPAD_ROWS = [
  ["1", "2", "3", "backspace"],
  ["4", "5", "6", "10"],
  ["7", "8", "9", "20"],
  ["0", "00", ".", "50"],
];

const PAYMENT_METHODS = [
  {
    id: "cash",
    label: "Cash",
    Icon: Banknote,
    className:
      "bg-[#42ecaf] text-[#0f583e] hover:bg-[#36d49c] active:bg-[#2db888]",
  },
  {
    id: "credit-card",
    label: "Credit Card",
    Icon: CreditCard,
    className:
      "bg-[#e1baff] text-[#362864] hover:bg-[#d4a8f5] active:bg-[#c796eb]",
  },
];

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatTenderDisplay(value) {
  if (value === "" || value == null) return "";
  const normalized = String(value).replace(/^\$\s*/, "");
  if (normalized === "" || normalized === ".") return "$ ";
  return `$ ${normalized}`;
}

/**
 * Right-side Amount Tendered drawer for POS payment.
 * Cash / card selection opens the Finalise Sale step with change due.
 */
export default function PosPaymentDrawer({
  isOpen,
  onClose,
  amountDue = 0,
  onCompleteSale,
}) {
  const [digits, setDigits] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const [step, setStep] = useState("tender"); // tender | finalise
  const [paymentSummary, setPaymentSummary] = useState(null);
  const amountDueLabel = Number(amountDue || 0)
    .toFixed(2)
    .replace(/\.00$/, "");

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setDigits("");
    setStep("tender");
    setPaymentSummary(null);
  }, [isOpen, amountDue]);

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

  function addQuickAmount(amount) {
    setDigits((prev) => {
      const current = prev === "" ? 0 : Number.parseFloat(prev);
      const base = Number.isFinite(current) ? current : 0;
      const next = Math.round((base + amount) * 100) / 100;
      return String(next);
    });
  }

  function handleKey(key) {
    if (key === "backspace") {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "10" || key === "20" || key === "50") {
      addQuickAmount(Number(key));
      return;
    }
    appendToken(key);
  }

  function resolvedAmount() {
    if (digits === "") return Number(amountDue) || 0;
    const parsed = Number.parseFloat(digits);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function handleSelectPayment(methodId) {
    const due = Number(amountDue) || 0;
    const tendered = resolvedAmount();
    const change = Math.max(0, Math.round((tendered - due) * 100) / 100);
    setPaymentSummary({
      method: methodId,
      amountDue: due,
      amountTendered: tendered,
      change,
    });
    setStep("finalise");
  }

  function handleCompleteSale() {
    onCompleteSale?.(paymentSummary);
    onClose?.();
  }

  function handleClose() {
    setStep("tender");
    setPaymentSummary(null);
    onClose?.();
  }

  if (!portalReady) return null;

  const displayValue =
    digits !== ""
      ? formatTenderDisplay(digits)
      : formatTenderDisplay(amountDueLabel);

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.button
          key="pos-payment-backdrop"
          type="button"
          aria-label="Close payment"
          className="fixed inset-0 z-40 bg-black/30"
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      ) : null}

      {isOpen ? (
        <motion.aside
          key="pos-payment-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={step === "finalise" ? "Finalise Sale" : "Amount Tendered"}
          className="fixed inset-y-0 right-0 z-50 flex w-[min(100%,28rem)] flex-col bg-[#984B28] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] shadow-2xl"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
        >
          {step === "finalise" && paymentSummary ? (
            <FinaliseSaleStep
              amountTendered={paymentSummary.amountTendered}
              change={paymentSummary.change}
              onCompleteSale={handleCompleteSale}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <p className="mb-3 text-center text-xl font-semibold text-white">
                Amount Tendered
              </p>

              <div className="mb-4 flex items-center gap-2">
                <div
                  className={cn(
                    "flex min-h-[3.25rem] flex-1 items-center justify-center rounded-lg bg-white px-4 py-4 text-center text-3xl font-bold tabular-nums",
                    digits ? "text-neutral-900" : "text-neutral-300",
                  )}
                >
                  {displayValue || "$ "}
                </div>
                <button
                  type="button"
                  aria-label="Tip"
                  className="flex size-12 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 active:bg-white/20"
                >
                  <HandCoins size={28} strokeWidth={1.75} />
                </button>
              </div>

              <div className="mb-4 grid grid-cols-4 gap-1.5">
                {KEYPAD_ROWS.flat().map((key) => {
                  if (key === "backspace") {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKey(key)}
                        className="flex h-16 items-center justify-center rounded-md bg-white text-2xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95"
                        aria-label="Delete"
                      >
                        <Delete size={20} strokeWidth={2.25} />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKey(key)}
                      className="flex h-16 items-center justify-center rounded-md bg-white text-2xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(({ id, label, Icon, className }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectPayment(id)}
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
          )}
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function FinaliseSaleStep({ amountTendered, change, onCompleteSale }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-white">Finalise Sale!</h2>
        <p className="mt-2 text-base font-medium text-white/95">
          Change required from: {formatMoney(amountTendered)}
        </p>

        <div className="mt-8 flex min-h-[4.5rem] w-full max-w-sm items-center justify-center rounded-lg bg-white px-4 py-5">
          <span className="text-4xl font-bold tabular-nums text-neutral-900">
            {formatMoney(change)}
          </span>
        </div>

        <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-3">
          <button
            type="button"
            className="min-h-[4.25rem] rounded-lg bg-[#E7AB94] px-3 text-sm font-bold uppercase tracking-wide text-[#984B23] transition-colors hover:bg-[#E7AB94] active:bg-[#E7AB94]"
          >
            Print Receipt
          </button>
          <button
            type="button"
            className="min-h-[4.25rem] rounded-lg bg-[#E7AB94] px-3 text-sm font-bold uppercase tracking-wide text-[#984B23] transition-colors hover:bg-[#E7AB94] active:bg-[#E7AB94]"
          >
            Email Receipt
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onCompleteSale}
        className="mt-6 flex min-h-[3.75rem] w-full items-center justify-center rounded-lg bg-[#ef3636] text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
      >
        Complete Sale
      </button>
    </div>
  );
}
