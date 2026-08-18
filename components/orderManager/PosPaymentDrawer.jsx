"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, CreditCard, Delete, HandCoins } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/helper";
import {
  buildTyroPurchaseParams,
  dollarsToTyroCents,
  getTyroIClientWithUI,
  getTyroPurchaseStatusMessage,
  initiateTyroPurchase,
  isTyroPurchaseApproved,
  parseTyroSurchargeDollars,
} from "@/lib/tyro/iclient";
import SideDrawer from "./SideDrawer";

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
  onPersistSale,
  onFinishPaidSale,
  onPrintReceipt,
  isPrintingReceipt = false,
  isCompletingSale = false,
  trainingMode = false,
  onTrainingDone,
  tyroCardEnabled = false,
  tyroConfig = null,
}) {
  const [digits, setDigits] = useState("");
  const [step, setStep] = useState("tender"); // tender | finalise
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isSalePersisted, setIsSalePersisted] = useState(false);
  const [tyroApproved, setTyroApproved] = useState(false);
  const purchaseLockRef = useRef(false);
  const amountDueLabel = Number(amountDue || 0)
    .toFixed(2)
    .replace(/\.00$/, "");
  const useTyroCard = Boolean(tyroCardEnabled) && !trainingMode;

  useEffect(() => {
    if (!isOpen) return;
    setDigits("");
    setStep("tender");
    setPaymentSummary(null);
    setIsPurchasing(false);
    setIsSalePersisted(false);
    setTyroApproved(false);
    purchaseLockRef.current = false;
  }, [isOpen, amountDue]);

  useEffect(() => {
    if (!isOpen || !useTyroCard) return;
    getTyroIClientWithUI().catch(() => {});
  }, [isOpen, useTyroCard]);

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

  async function runTyroCardPurchase(due) {
    if (purchaseLockRef.current) return;
    purchaseLockRef.current = true;
    setIsPurchasing(true);

    try {
      const iclient = await getTyroIClientWithUI();
      const requestParams = buildTyroPurchaseParams({
        amount: dollarsToTyroCents(due),
        mid: tyroConfig?.mid,
        tid: tyroConfig?.tid,
        integrationKey: tyroConfig?.integrationKey,
        integratedReceipt: Boolean(tyroConfig?.integratedReceipt),
        enableSurcharge: tyroConfig?.enableSurcharge !== false,
      });

      if (!requestParams) {
        toast.error("Invalid amount for card payment");
        return;
      }

      const result = await initiateTyroPurchase(iclient, requestParams);
      if (!isTyroPurchaseApproved(result)) {
        toast.error(getTyroPurchaseStatusMessage(result));
        return;
      }

      const processingFee = parseTyroSurchargeDollars(result);
      const charged = Math.round((due + processingFee) * 100) / 100;

      const summary = {
        method: "credit-card",
        amountDue: due,
        amountTendered: charged,
        change: 0,
        processingFee,
      };
      setPaymentSummary(summary);
      setStep("finalise");
      setTyroApproved(true);

      const persist = await onPersistSale?.(summary);
      if (persist?.success) {
        setIsSalePersisted(true);
      }
    } catch (error) {
      toast.error(error?.message || "Card payment failed");
    } finally {
      purchaseLockRef.current = false;
      setIsPurchasing(false);
    }
  }

  function handleSelectPayment(methodId) {
    if (isPurchasing || isCompletingSale) return;

    const due = Number(amountDue) || 0;
    const tendered = resolvedAmount();
    const change = Math.max(0, Math.round((tendered - due) * 100) / 100);

    if (methodId === "credit-card" && Boolean(tyroConfig?.enabled) && !trainingMode) {
      if (!useTyroCard) {
        toast.error("Authorise the Tyro terminal in Settings first");
        return;
      }
      runTyroCardPurchase(due);
      return;
    }

    setPaymentSummary({
      method: methodId,
      amountDue: due,
      amountTendered: tendered,
      change,
    });
    setStep("finalise");
  }

  function handleCompleteSale() {
    if (isSalePersisted) {
      onFinishPaidSale?.();
      return;
    }
    onCompleteSale?.(paymentSummary);
  }

  function handleClose() {
    if (isPurchasing || tyroApproved) return;
    setStep("tender");
    setPaymentSummary(null);
    onClose?.();
  }

  const displayValue =
    digits !== ""
      ? formatTenderDisplay(digits)
      : formatTenderDisplay(amountDueLabel);

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      showHeader={false}
      side="right"
      zIndex={40}
      closeDisabled={isPurchasing || tyroApproved}
      panelClassName="bg-[#984B28]"
      bodyClassName=""
      contentKey="pos-payment-drawer"
      ariaLabel={step === "finalise" ? "Finalise Sale" : "Amount Tendered"}
    >
      {step === "finalise" && paymentSummary ? (
        <FinaliseSaleStep
          paymentSummary={paymentSummary}
          amountTendered={paymentSummary.amountTendered}
          change={paymentSummary.change}
          processingFee={Number(paymentSummary.processingFee || 0)}
          onCompleteSale={handleCompleteSale}
          onPrintReceipt={onPrintReceipt}
          isPrintingReceipt={isPrintingReceipt}
          isCompletingSale={isCompletingSale}
          isSalePersisted={isSalePersisted}
          trainingMode={trainingMode}
          onTrainingDone={onTrainingDone}
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
                    disabled={isPurchasing || isCompletingSale}
                    className="flex h-16 items-center justify-center rounded-md bg-white text-2xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
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
                  disabled={isPurchasing || isCompletingSale}
                  className="flex h-16 items-center justify-center rounded-md bg-white text-2xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {key}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(({ id, label, Icon, className }) => {
              const isCardWaiting = id === "credit-card" && isPurchasing;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isPurchasing || isCompletingSale}
                  onClick={() => handleSelectPayment(id)}
                  className={cn(
                    "flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wide shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                    className,
                  )}
                >
                  <Icon size={28} strokeWidth={1.75} />
                  {isCardWaiting ? "Waiting for EFTPOS…" : label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </SideDrawer>
  );
}

function FinaliseSaleStep({
  paymentSummary,
  amountTendered,
  change,
  processingFee = 0,
  onCompleteSale,
  onPrintReceipt,
  isPrintingReceipt = false,
  isCompletingSale = false,
  isSalePersisted = false,
  trainingMode = false,
  onTrainingDone,
}) {
  const completeLabel = isSalePersisted
    ? "Done"
    : isCompletingSale
      ? "Saving…"
      : "Complete Sale";
  const isCard = paymentSummary?.method === "credit-card";
  const hasCardFee = isCard && Number(processingFee) > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-white">
          {trainingMode ? "Training Payment" : "Finalise Sale!"}
        </h2>
        {isCard ? (
          <p className="mt-2 text-base font-medium text-white/95">
            Amount charged
          </p>
        ) : (
          <p className="mt-2 text-base font-medium text-white/95">
            Change required from: {formatMoney(amountTendered)}
          </p>
        )}

        <div className="mt-8 flex min-h-[4.5rem] w-full max-w-sm items-center justify-center rounded-lg bg-white px-4 py-5">
          <span className="text-4xl font-bold tabular-nums text-neutral-900">
            {formatMoney(isCard ? amountTendered : change)}
          </span>
        </div>

        {hasCardFee ? (
          <p className="mt-3 text-sm font-medium text-white/90">
            Includes surcharge {formatMoney(processingFee)}
          </p>
        ) : null}

        {trainingMode ? (
          <p className="mt-5 max-w-sm text-sm text-white/85">
            Nothing is saved. Close this step, then tap Hold to clear the
            training check.
          </p>
        ) : (
          <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isPrintingReceipt}
              onClick={() => onPrintReceipt?.(paymentSummary)}
              className="min-h-[4.25rem] rounded-lg bg-[#E7AB94] px-3 text-sm font-bold uppercase tracking-wide text-[#984B23] transition-colors hover:bg-[#E7AB94] active:bg-[#E7AB94] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPrintingReceipt ? "Printing…" : "Print Receipt"}
            </button>
            <button
              type="button"
              className="min-h-[4.25rem] rounded-lg bg-[#E7AB94] px-3 text-sm font-bold uppercase tracking-wide text-[#984B23] transition-colors hover:bg-[#E7AB94] active:bg-[#E7AB94]"
            >
              Email Receipt
            </button>
          </div>
        )}
      </div>

      {trainingMode ? (
        <button
          type="button"
          onClick={onTrainingDone}
          className="mt-6 flex min-h-[3.75rem] w-full items-center justify-center rounded-lg bg-white text-base font-bold uppercase tracking-wide text-[#984B28] transition-colors hover:bg-white/95 active:bg-white/90"
        >
          Done
        </button>
      ) : (
        <button
          type="button"
          onClick={onCompleteSale}
          disabled={isCompletingSale}
          className="mt-6 flex min-h-[3.75rem] w-full items-center justify-center rounded-lg bg-[#ef3636] text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {completeLabel}
        </button>
      )}
    </div>
  );
}
