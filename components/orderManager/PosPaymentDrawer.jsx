"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, CreditCard, Delete, HandCoins, X } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/helper";
import { usePosRegisterSession } from "@/components/context/PosRegisterSessionContext";
import {
  buildTyroPurchaseParams,
  dollarsToTyroCents,
  getTyroIClientWithUI,
  getTyroPurchaseStatusMessage,
  initiateTyroPurchase,
  isTyroPurchaseApproved,
  parseTyroSurchargeDollars,
} from "@/lib/tyro/iclient";
import { purchaseLinkly } from "@/lib/api/fetchApi";
import {
  classifyLinklyTxnOutcome,
  isLinklyOutcomePayable,
  linklyOutcomeMessage,
} from "@/lib/linkly/txnOutcome";
import { setLinklyLastTxnOutcome } from "@/lib/linkly/lastTxnOutcome";
import { printLinklyTxnReceipt } from "@/lib/printers/printLinklyTxnReceipt";
import { useMenuContext } from "@/components/context/MenuContext";
import SideDrawer from "./SideDrawer";

const CASH_DISABLED_MESSAGE =
  "Cash payments are unavailable because register counts have been finalised. Please use another payment method.";

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
  /** When true, Credit Card runs Linkly Cloud purchase then persists the sale. */
  linklyCardEnabled = false,
  linklyConfig = null,
  onOpenCashDrawer,
  /** Held QR counter pay: cash/card tender and Complete Sale, no tax invoice print. */
  hideReceiptActions = false,
}) {
  const { session } = usePosRegisterSession();
  const { storeProfile } = useMenuContext();
  const countsFinalised = Boolean(session?.countsFinalised);
  const [digits, setDigits] = useState("");
  const [step, setStep] = useState("tender"); // tender | finalise | signature
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isSalePersisted, setIsSalePersisted] = useState(false);
  const [invoiceSaleCompleted, setInvoiceSaleCompleted] = useState(false);
  // True after integrated EFTPOS (Tyro or Linkly) approved — blocks closing mid-flow.
  const [cardApproved, setCardApproved] = useState(false);
  const [isCashDisabledOpen, setIsCashDisabledOpen] = useState(false);
  /** Linkly txn awaiting merchant signature accept/reject (ResponseCode 08). */
  const [pendingLinklyTxn, setPendingLinklyTxn] = useState(null);
  const [pendingLinklyDue, setPendingLinklyDue] = useState(0);
  const purchaseLockRef = useRef(false);
  const amountDueLabel = Number(amountDue || 0)
    .toFixed(2)
    .replace(/\.00$/, "");
  const useTyroCard = Boolean(tyroCardEnabled) && !trainingMode;
  const useLinklyCard = Boolean(linklyCardEnabled) && !trainingMode;
  // Prefer Linkly when both somehow enabled (config mutual-exclusion should prevent this).
  const integratedCardPartner = useLinklyCard
    ? "linkly"
    : useTyroCard
      ? "tyro"
      : null;

  useEffect(() => {
    if (!isOpen) return;
    setDigits("");
    setStep("tender");
    setPaymentSummary(null);
    setIsPurchasing(false);
    setIsSalePersisted(false);
    setInvoiceSaleCompleted(false);
    setCardApproved(false);
    setIsCashDisabledOpen(false);
    setPendingLinklyTxn(null);
    setPendingLinklyDue(0);
    purchaseLockRef.current = false;
  }, [isOpen, amountDue]);

  useEffect(() => {
    if (!isOpen || integratedCardPartner !== "tyro") return;
    getTyroIClientWithUI().catch(() => {});
  }, [isOpen, integratedCardPartner]);

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
      setCardApproved(true);

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

  /**
   * Linkly Cloud sync purchase → mark paid via same complete-sale path as Tyro.
   * Handles accreditation outcomes: 08 signature gate, TO timeout, declined.
   * REVIEW: txnRef / rfn not persisted on the order yet (same as Tyro today).
   */
  async function finaliseLinklyApprovedSale(due, transaction) {
    const summary = {
      method: "credit-card",
      amountDue: due,
      amountTendered: due,
      change: 0,
      processingFee: 0,
      linkly: {
        txnRef: transaction.txnRef || null,
        rrn: transaction.rrn || null,
        rfn: transaction.rfn || null,
        sessionId: transaction.sessionId || null,
        responseCode: transaction.responseCode || null,
        outcome: transaction.outcome || null,
      },
    };
    setPaymentSummary(summary);
    setStep("finalise");
    setCardApproved(true);
    setPendingLinklyTxn(null);

    const persist = await onPersistSale?.(summary);
    if (persist?.success) {
      setIsSalePersisted(true);
    }
  }

  async function recordLinklyOutcome(transaction, { markedFailed, source }) {
    const outcome =
      transaction?.outcome || classifyLinklyTxnOutcome(transaction || {});
    await setLinklyLastTxnOutcome({
      sessionId: transaction?.sessionId,
      txnRef: transaction?.txnRef,
      outcome,
      success: Boolean(transaction?.success),
      responseCode: transaction?.responseCode,
      responseText: transaction?.responseText,
      amountCents: transaction?.amtPurchase || transaction?.requestedAmountCents,
      markedFailed,
      source,
    });
  }

  async function runLinklyCardPurchase(due) {
    if (purchaseLockRef.current) return;
    purchaseLockRef.current = true;
    setIsPurchasing(true);

    try {
      const amountCents = Math.round(Number(due) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        toast.error("Invalid amount for card payment");
        return;
      }

      const result = await purchaseLinkly({ amountCents });
      if (!result?.success) {
        toast.error(result?.error || "Card payment failed");
        return;
      }

      const txn = result.transaction || {};
      const outcome = txn.outcome || classifyLinklyTxnOutcome(txn);
      txn.outcome = outcome;

      if (outcome === "operator_timeout") {
        await recordLinklyOutcome(txn, {
          markedFailed: true,
          source: "pos-purchase",
        });
        setPendingLinklyTxn(txn);
        setPendingLinklyDue(due);
        setStep("timeout");
        // Accreditation 2.1.3 — leave sale incomplete; print result slip with TxnRef.
        printLinklyTxnReceipt(txn, storeProfile || {}, {
          documentTitle: "CARD RESULT (TIMEOUT)",
        }).catch(() => {});
        return;
      }

      if (outcome === "declined" || !isLinklyOutcomePayable(outcome)) {
        await recordLinklyOutcome(txn, {
          markedFailed: true,
          source: "pos-purchase",
        });
        setPendingLinklyTxn(txn);
        setPendingLinklyDue(due);
        setStep("declined");
        printLinklyTxnReceipt(txn, storeProfile || {}, {
          documentTitle: "CARD RESULT (FAILED)",
        }).catch(() => {});
        return;
      }

      if (outcome === "approved_signature") {
        setPendingLinklyTxn(txn);
        setPendingLinklyDue(due);
        setStep("signature");
        toast(linklyOutcomeMessage(outcome, txn), { duration: 6000 });
        // Print signature / merchant copy for verification (sync has no ReceiptEvent).
        printLinklyTxnReceipt(txn, storeProfile || {}, {
          documentTitle: "SIGNATURE COPY",
        }).catch(() => {});
        return;
      }

      await recordLinklyOutcome(txn, {
        markedFailed: false,
        source: "pos-purchase",
      });
      await finaliseLinklyApprovedSale(due, txn);
    } catch (error) {
      toast.error(error?.message || "Card payment failed");
    } finally {
      purchaseLockRef.current = false;
      setIsPurchasing(false);
    }
  }

  async function handleLinklySignatureAccept() {
    if (!pendingLinklyTxn || isPurchasing || isCompletingSale) return;
    const txn = pendingLinklyTxn;
    const due = pendingLinklyDue;
    await recordLinklyOutcome(txn, {
      markedFailed: false,
      source: "pos-signature",
    });
    await finaliseLinklyApprovedSale(due, txn);
  }

  async function handleLinklySignatureReject() {
    if (!pendingLinklyTxn || isPurchasing || isCompletingSale) return;
    const txn = {
      ...pendingLinklyTxn,
      outcome: "declined",
      success: false,
      responseText: "Signature rejected by merchant",
    };
    await recordLinklyOutcome(txn, {
      markedFailed: true,
      source: "pos-signature",
    });
    setPendingLinklyTxn(null);
    setPendingLinklyDue(0);
    setStep("tender");
    toast.error("Signature rejected — sale not completed");
  }

  function handleLinklyFailedDismiss() {
    setPendingLinklyTxn(null);
    setPendingLinklyDue(0);
    setStep("tender");
  }

  function handleSelectPayment(methodId) {
    if (isPurchasing || isCompletingSale) return;

    if (methodId === "cash" && countsFinalised && !trainingMode) {
      setIsCashDisabledOpen(true);
      return;
    }

    const due = Number(amountDue) || 0;
    const tendered = resolvedAmount();
    const change = Math.max(0, Math.round((tendered - due) * 100) / 100);

    if (methodId === "credit-card" && !trainingMode) {
      if (integratedCardPartner === "linkly") {
        runLinklyCardPurchase(due);
        return;
      }
      if (Boolean(linklyConfig?.enabled)) {
        toast.error("Pair the Linkly terminal in Settings first");
        return;
      }
      if (integratedCardPartner === "tyro" || Boolean(tyroConfig?.enabled)) {
        if (!useTyroCard) {
          toast.error("Authorise the Tyro terminal in Settings first");
          return;
        }
        runTyroCardPurchase(due);
        return;
      }
      // No integrated partner — manual card (approve on terminal, then Complete Sale).
    }

    if (methodId === "cash") {
      void onOpenCashDrawer?.();
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
    if (isPurchasing || cardApproved || invoiceSaleCompleted) return;
    if (step === "signature") return;
    setStep("tender");
    setPaymentSummary(null);
    setPendingLinklyTxn(null);
    onClose?.();
  }

  const displayValue =
    digits !== ""
      ? formatTenderDisplay(digits)
      : formatTenderDisplay(amountDueLabel);

  const isFailedResultStep = step === "timeout" || step === "declined";

  return (
    <>
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      showHeader={false}
      side="right"
      widthClassName="w-[min(100%,20rem)] md:w-[min(100%,28rem)]"
      closeDisabled={
        isPurchasing ||
        cardApproved ||
        invoiceSaleCompleted ||
        step === "signature"
      }
      panelClassName="bg-[#984B28]"
      bodyClassName=""
      contentKey="pos-payment-drawer"
      ariaLabel={
        step === "finalise"
          ? "Finalise Sale"
          : step === "signature"
            ? "Signature verification"
            : step === "timeout"
              ? "Operator timeout"
              : step === "declined"
                ? "Card declined"
                : "Amount Tendered"
      }
    >
      {step === "signature" && pendingLinklyTxn ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 text-white">
          <p className="mb-2 text-center text-xl font-semibold">
            Signature required
          </p>
          <p className="mb-4 text-center text-sm text-white/90">
            ResponseCode{" "}
            <span className="font-mono">
              {pendingLinklyTxn.responseCode || "08"}
            </span>
            . Verify the customer signature on the merchant copy, then accept or
            reject.
          </p>
          <dl className="mb-6 space-y-2 rounded-lg bg-white/10 px-4 py-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-white/70">Amount</dt>
              <dd className="font-semibold">
                {formatMoney(pendingLinklyDue)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/70">TxnRef</dt>
              <dd className="font-mono text-xs">
                {pendingLinklyTxn.txnRef || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/70">Message</dt>
              <dd className="text-right text-xs">
                {pendingLinklyTxn.responseText || "Approved with signature"}
              </dd>
            </div>
          </dl>
          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLinklySignatureAccept}
              disabled={isCompletingSale}
              className="w-full rounded-lg bg-[#42ecaf] py-3.5 text-base font-bold text-[#0f583e] disabled:opacity-60"
            >
              Accept signature
            </button>
            <button
              type="button"
              onClick={handleLinklySignatureReject}
              disabled={isCompletingSale}
              className="w-full rounded-lg bg-white/15 py-3.5 text-base font-semibold text-white hover:bg-white/25 disabled:opacity-60"
            >
              Reject — cancel sale
            </button>
          </div>
        </div>
      ) : isFailedResultStep && pendingLinklyTxn ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 text-white">
          <p className="mb-2 text-center text-xl font-semibold">
            {step === "timeout" ? "Operator timeout" : "Card not approved"}
          </p>
          <p className="mb-4 text-center text-sm text-white/90">
            {step === "timeout"
              ? "TO — Operator TimeOut. Sale is incomplete — do not mark as paid."
              : "Card payment failed. Sale is incomplete — do not mark as paid."}
          </p>
          <dl className="mb-6 space-y-2 rounded-lg bg-white/10 px-4 py-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-white/70">ResponseCode</dt>
              <dd className="font-mono font-semibold">
                {pendingLinklyTxn.responseCode ||
                  (step === "timeout" ? "TO" : "—")}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/70">TxnRef</dt>
              <dd className="font-mono text-xs">
                {pendingLinklyTxn.txnRef || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/70">Message</dt>
              <dd className="text-right text-xs">
                {linklyOutcomeMessage(
                  pendingLinklyTxn.outcome ||
                    (step === "timeout" ? "operator_timeout" : "declined"),
                  pendingLinklyTxn,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/70">POS status</dt>
              <dd className="font-semibold text-red-200">FAILED</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleLinklyFailedDismiss}
            className="mt-auto w-full rounded-lg bg-white py-3.5 text-base font-bold text-[#984B28]"
          >
            OK — retry card or choose another method
          </button>
        </div>
      ) : step === "finalise" && paymentSummary ? (
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
          invoiceSaleCompleted={invoiceSaleCompleted}
          onInvoicePrinted={() => {
            setIsSalePersisted(true);
            setInvoiceSaleCompleted(true);
          }}
          trainingMode={trainingMode}
          onTrainingDone={onTrainingDone}
          hideReceiptActions={hideReceiptActions}
          showManualCardInstruction={
            paymentSummary.method === "credit-card" &&
            !cardApproved &&
            !trainingMode
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 md:p-4">
          <p className="mb-2 text-center text-lg font-semibold text-white md:mb-3 md:text-xl">
            Amount Tendered
          </p>

          <div className="mb-3 flex items-center gap-2 md:mb-4">
            <div
              className={cn(
                "flex min-h-[2.75rem] flex-1 items-center justify-center rounded-lg bg-white px-3 py-3 text-center text-2xl font-bold tabular-nums md:min-h-[3.25rem] md:px-4 md:py-4 md:text-3xl",
                digits ? "text-neutral-900" : "text-neutral-300",
              )}
            >
              {displayValue || "$ "}
            </div>
            <button
              type="button"
              aria-label="Tip"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 active:bg-white/20 md:size-12"
            >
              <HandCoins size={24} strokeWidth={1.75} />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-4 gap-1 md:mb-4 md:gap-1.5">
            {KEYPAD_ROWS.flat().map((key) => {
              if (key === "backspace") {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKey(key)}
                    disabled={isPurchasing || isCompletingSale}
                    className="flex h-12 items-center justify-center rounded-md bg-white text-xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 md:h-16 md:text-2xl"
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
                  disabled={isPurchasing || isCompletingSale}
                  className="flex h-12 items-center justify-center rounded-md bg-white text-xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 md:h-16 md:text-2xl"
                >
                  {key}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-1.5 md:gap-2">
            {PAYMENT_METHODS.map(({ id, label, Icon, className }) => {
              const isCardWaiting = id === "credit-card" && isPurchasing;
              const isCashLocked =
                id === "cash" && countsFinalised && !trainingMode;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isPurchasing || isCompletingSale}
                  onClick={() => handleSelectPayment(id)}
                  className={cn(
                    "flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-wide shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 md:min-h-[5.5rem] md:gap-1.5 md:px-3 md:py-3 md:text-sm",
                    className,
                    isCashLocked && "opacity-55",
                  )}
                >
                  <Icon size={22} strokeWidth={1.75} />
                  {isCardWaiting ? "Waiting for EFTPOS…" : label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </SideDrawer>

      <dialog className={`modal ${isCashDisabledOpen ? "modal-open" : ""}`}>
        <div className="modal-box w-[400px] max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">
              Cash unavailable
            </h3>
            <button
              type="button"
              onClick={() => setIsCashDisabledOpen(false)}
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-6 text-sm text-neutral-700">{CASH_DISABLED_MESSAGE}</p>

          <button
            type="button"
            onClick={() => setIsCashDisabledOpen(false)}
            className="w-full rounded-xl bg-brand_accent px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            OK
          </button>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit" onClick={() => setIsCashDisabledOpen(false)}>
            close
          </button>
        </form>
      </dialog>
    </>
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
  invoiceSaleCompleted = false,
  onInvoicePrinted,
  trainingMode = false,
  onTrainingDone,
  hideReceiptActions = false,
  showManualCardInstruction = false,
}) {
  const completeLabel = invoiceSaleCompleted
    ? "Sale Completed"
    : isSalePersisted
      ? "Done"
      : isCompletingSale
        ? "Saving…"
        : "Complete Sale";
  const isCard = paymentSummary?.method === "credit-card";
  const hasCardFee = isCard && Number(processingFee) > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 md:p-5">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="text-xl font-bold text-white md:text-2xl">
          {trainingMode ? "Training Payment" : "Finalise Sale!"}
        </h2>
        {isCard ? (
          <p className="mt-2 text-sm font-medium text-white/95 md:text-base">
            Amount charged
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-white/95 md:text-base">
            Change required from: {formatMoney(amountTendered)}
          </p>
        )}

        <div className="mt-5 flex min-h-[3.5rem] w-full max-w-sm items-center justify-center rounded-lg bg-white px-3 py-4 md:mt-8 md:min-h-[4.5rem] md:px-4 md:py-5">
          <span className="text-3xl font-bold tabular-nums text-neutral-900 md:text-4xl">
            {formatMoney(isCard ? amountTendered : change)}
          </span>
        </div>

        {showManualCardInstruction ? (
          <p className="mt-4 max-w-sm text-sm font-bold text-white md:mt-5 md:text-base">
            Approve the card payment on your EFTPOS terminal, then tap Complete
            Sale.
          </p>
        ) : null}

        {hasCardFee ? (
          <p className="mt-3 text-sm font-medium text-white/90">
            Includes surcharge {formatMoney(processingFee)}
          </p>
        ) : null}

        {trainingMode ? (
          <p className="mt-4 max-w-sm text-sm text-white/85 md:mt-5">
            Nothing is saved. Close this step, then tap Hold to clear the
            training check.
          </p>
        ) : hideReceiptActions ? null : (
          <div className="mt-4 w-full max-w-sm md:mt-5">
            <button
              type="button"
              disabled={isPrintingReceipt || isCompletingSale}
              onClick={async () => {
                const result = await onPrintReceipt?.(paymentSummary);
                if (result?.salePersisted) {
                  onInvoicePrinted?.();
                }
              }}
              className="min-h-[3.25rem] w-full rounded-lg bg-[#E7AB94] px-3 text-sm font-bold uppercase tracking-wide text-[#984B23] transition-colors hover:bg-[#E7AB94] active:bg-[#E7AB94] disabled:cursor-not-allowed disabled:opacity-60 md:min-h-[4.25rem]"
            >
              {isPrintingReceipt ? "Printing…" : "Print Invoice"}
            </button>
          </div>
        )}
      </div>

      {trainingMode ? (
        <button
          type="button"
          onClick={onTrainingDone}
          className="mt-4 flex min-h-[3rem] w-full items-center justify-center rounded-lg bg-white text-sm font-bold uppercase tracking-wide text-[#984B28] transition-colors hover:bg-white/95 active:bg-white/90 md:mt-6 md:min-h-[3.75rem] md:text-base"
        >
          Done
        </button>
      ) : (
        <button
          type="button"
          onClick={onCompleteSale}
          disabled={isCompletingSale || isPrintingReceipt}
          className="mt-4 flex min-h-[3rem] w-full items-center justify-center rounded-lg bg-[#ef3636] text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24] disabled:cursor-not-allowed disabled:opacity-70 md:mt-6 md:min-h-[3.75rem] md:text-base"
        >
          {completeLabel}
        </button>
      )}
    </div>
  );
}
