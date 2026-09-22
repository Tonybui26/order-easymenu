"use client";

/**
 * Linkly Cloud terminal settings — pairing + sandbox purchase test.
 *
 * Flow (sandbox accreditation):
 * 1. Enable Linkly for the store in easymenu Admin → POS → Payments.
 * 2. On Windows VPP: enable Cloud (FUNC 7410…) then FUNC → 8880 → pair code.
 * 3. Pair here with Cloud username + password + pair code.
 * 4. Run a test purchase (token + sync txn on easymenu). VPP should prompt.
 *
 * REVIEW / next steps:
 * - Persist Linkly txnRef/rfn on orders for matched refunds from live sales
 * - Host merchant pairing guide URL (1.4) + supply POS logo (1.5)
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import {
  fetchGetMenuByOwnerEmail,
  pairLinklyTerminal,
  purchaseLinkly,
  queryLinklyTransactionStatus,
  refundLinkly,
} from "@/lib/api/fetchApi";
import {
  getLinklyInflightSession,
  clearLinklyInflightSession,
} from "@/lib/linkly/inflightSession";
import {
  getLinklyLastTxnOutcome,
  clearLinklyLastTxnOutcome,
  setLinklyLastTxnOutcome,
} from "@/lib/linkly/lastTxnOutcome";
import {
  classifyLinklyTxnOutcome,
  linklyOutcomeMessage,
} from "@/lib/linkly/txnOutcome";
import { printLinklyTxnReceipt } from "@/lib/printers/printLinklyTxnReceipt";
import {
  buildMenuConfigWithLinklyUnpair,
  isLinklyPosPaymentPaired,
  resolvePosPaymentsConfig,
} from "@/lib/pos/posPaymentsConfig";

/** VPP sandbox often returns empty PAD/RFN; placeholder lets refund UI be exercised. */
const SANDBOX_REFUND_RFN_PLACEHOLDER = "SANDBOX-RFN";

function formatPairedAt(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function StatusValue({ variant = "neutral", children }) {
  const styles = {
    success: "text-emerald-700",
    error: "text-red-700",
    pending: "text-neutral-600",
    neutral: "text-neutral-500",
  };

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    pending: Loader2,
    neutral: Circle,
  };

  const Icon = icons[variant] || Circle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${styles[variant] || styles.neutral}`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${variant === "pending" ? "animate-spin" : ""}`}
        aria-hidden
      />
      {children}
    </span>
  );
}

export default function LinklyPaymentSettingsPage() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { userData } = useGlobalAppContext();
  const {
    menuConfig,
    saveMenuConfigExplicit,
    syncCatalogFromServer,
    dataLoaded,
    storeProfile,
  } = useMenuContext();

  const savedLinkly = useMemo(
    () => resolvePosPaymentsConfig(menuConfig).linkly,
    [menuConfig],
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [isUnpairing, setIsUnpairing] = useState(false);
  const [pairStatus, setPairStatus] = useState("");
  const [pairMessage, setPairMessage] = useState("");
  const [hasSeededUsername, setHasSeededUsername] = useState(false);

  // Sandbox purchase / refund tests (do not update live orders).
  const [purchaseAmountDollars, setPurchaseAmountDollars] = useState("1.00");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [lastPurchase, setLastPurchase] = useState(null);
  const [purchaseError, setPurchaseError] = useState("");

  const [refundAmountDollars, setRefundAmountDollars] = useState("1.00");
  const [refundRfn, setRefundRfn] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [lastRefund, setLastRefund] = useState(null);
  const [refundError, setRefundError] = useState("");

  // Mandatory error recovery (accreditation 3.1 / 4.1).
  const [recoverySessionId, setRecoverySessionId] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastRecovery, setLastRecovery] = useState(null);
  const [recoveryError, setRecoveryError] = useState("");
  const [deviceInflight, setDeviceInflight] = useState(null);
  const [lastPosOutcome, setLastPosOutcome] = useState(null);

  const isPaired = isLinklyPosPaymentPaired(savedLinkly);
  const pairedAtLabel = formatPairedAt(savedLinkly.pairedAt);

  useEffect(() => {
    if (!dataLoaded || hasSeededUsername) return;
    const storedUsername = String(savedLinkly.username ?? "").trim();
    if (storedUsername) setUsername(storedUsername);
    setHasSeededUsername(true);
  }, [dataLoaded, hasSeededUsername, savedLinkly.username]);

  useEffect(() => {
    let cancelled = false;
    async function loadInflight() {
      const [inflight, outcome] = await Promise.all([
        getLinklyInflightSession(),
        getLinklyLastTxnOutcome(),
      ]);
      if (cancelled) return;
      setDeviceInflight(inflight);
      setLastPosOutcome(outcome);
      if (inflight?.sessionId && !recoverySessionId) {
        setRecoverySessionId(inflight.sessionId);
      } else if (
        !recoverySessionId &&
        (savedLinkly.pendingSessionId || savedLinkly.lastSessionId)
      ) {
        setRecoverySessionId(
          String(savedLinkly.pendingSessionId || savedLinkly.lastSessionId),
        );
      }
    }
    loadInflight();
    return () => {
      cancelled = true;
    };
    // Seed once when config / pair state is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded, isPaired, savedLinkly.pendingSessionId, savedLinkly.lastSessionId]);

  async function handlePair() {
    const usernameTrimmed = String(username ?? "").trim();
    const passwordValue = String(password ?? "");
    const pairCodeTrimmed = String(pairCode ?? "").trim();

    if (!usernameTrimmed || !passwordValue || !pairCodeTrimmed) {
      toast.error("Enter username, password, and the pair code from the VPP");
      return;
    }

    setIsPairing(true);
    setPairStatus("inProgress");
    setPairMessage("Pairing with Linkly Cloud…");

    try {
      const result = await pairLinklyTerminal({
        username: usernameTrimmed,
        password: passwordValue,
        pairCode: pairCodeTrimmed,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Pairing failed");
      }

      // Do not keep password / one-time pair code in React state after success.
      setPassword("");
      setPairCode("");
      setPairStatus("success");
      setPairMessage(
        result?.linkly?.paired
          ? "Terminal paired. Pairing secret stored for this store."
          : result?.message || "Terminal paired",
      );

      // Pairing already wrote menu.config on easymenu — pull fresh config into OM.
      await syncCatalogFromServer({ ownerEmail: userData?.ownerEmail });
      toast.success("Linkly terminal paired");
    } catch (error) {
      const message = error?.message || "Pairing failed";
      setPairStatus("failure");
      setPairMessage(message);
      toast.error(message);
    } finally {
      setIsPairing(false);
    }
  }

  async function handleUnpair() {
    if (!userData?.ownerEmail || isUnpairing) return;

    setIsUnpairing(true);
    try {
      const latestData = await fetchGetMenuByOwnerEmail(userData.ownerEmail);
      const freshConfig = latestData?.config || {};
      const configToSave = buildMenuConfigWithLinklyUnpair(freshConfig);
      const result = await saveMenuConfigExplicit(configToSave);

      if (!result?.success) {
        throw new Error(result?.error?.message || "Failed to clear pairing");
      }

      setPairStatus("");
      setPairMessage("");
      setLastPurchase(null);
      setPurchaseError("");
      setLastRefund(null);
      setRefundError("");
      setRefundRfn("");
      setLastRecovery(null);
      setRecoveryError("");
      setRecoverySessionId("");
      await clearLinklyInflightSession();
      setDeviceInflight(null);
      await clearLinklyLastTxnOutcome();
      setLastPosOutcome(null);
      toast.success("Linkly pairing cleared");
    } catch (error) {
      toast.error(error?.message || "Failed to unpair");
    } finally {
      setIsUnpairing(false);
    }
  }

  async function handleTestPurchase() {
    if (!isPaired) {
      toast.error("Pair the terminal before running a purchase");
      return;
    }

    const dollars = Number(String(purchaseAmountDollars).replace(/[^0-9.]/g, ""));
    const amountCents = Math.round(dollars * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid amount (e.g. 1.00)");
      return;
    }

    setIsPurchasing(true);
    setPurchaseError("");
    setLastPurchase(null);

    try {
      // easymenu: secret → token → sync purchase; VPP should show the txn.
      const result = await purchaseLinkly({ amountCents });

      if (!result?.success) {
        if (result?.sessionId) setRecoverySessionId(result.sessionId);
        if (result?.resultUnknown) {
          setDeviceInflight(await getLinklyInflightSession());
        }
        throw new Error(result?.error || "Purchase failed");
      }

      setLastPurchase(result.transaction);
      if (result.transaction?.sessionId) {
        setRecoverySessionId(result.transaction.sessionId);
      }
      setDeviceInflight(null);

      const txn = result.transaction || {};
      const outcome = txn.outcome || classifyLinklyTxnOutcome(txn);
      const markedFailed =
        outcome === "declined" || outcome === "operator_timeout";
      await setLinklyLastTxnOutcome({
        sessionId: txn.sessionId,
        txnRef: txn.txnRef,
        outcome,
        success: Boolean(txn.success),
        responseCode: txn.responseCode,
        responseText: txn.responseText,
        amountCents: txn.amtPurchase || amountCents,
        markedFailed,
        source: "settings-purchase",
      });
      setLastPosOutcome(await getLinklyLastTxnOutcome());

      if (outcome === "approved" || outcome === "approved_signature") {
        setRefundAmountDollars(
          (
            Number(result.transaction.amtPurchase || amountCents) / 100
          ).toFixed(2),
        );
        const purchaseRfn = String(result.transaction.rfn || "").trim();
        setRefundRfn(purchaseRfn || SANDBOX_REFUND_RFN_PLACEHOLDER);
        setLastRefund(null);
        setRefundError("");
        toast.success(linklyOutcomeMessage(outcome, txn));
      } else {
        toast.error(linklyOutcomeMessage(outcome, txn));
      }
    } catch (error) {
      const message = error?.message || "Purchase failed";
      setPurchaseError(message);
      toast.error(message);
      const inflight = await getLinklyInflightSession();
      setDeviceInflight(inflight);
      if (inflight?.sessionId) setRecoverySessionId(inflight.sessionId);
    } finally {
      setIsPurchasing(false);
    }
  }

  async function handleTestRefund() {
    if (!isPaired) {
      toast.error("Pair the terminal before running a refund");
      return;
    }

    const dollars = Number(String(refundAmountDollars).replace(/[^0-9.]/g, ""));
    const amountCents = Math.round(dollars * 100);
    const rfnTrimmed = String(refundRfn ?? "").trim();

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid refund amount (e.g. 1.00)");
      return;
    }
    if (!rfnTrimmed) {
      toast.error("RFN is required for a matched refund");
      return;
    }

    setIsRefunding(true);
    setRefundError("");
    setLastRefund(null);

    try {
      const result = await refundLinkly({
        amountCents,
        rfn: rfnTrimmed,
      });

      if (!result?.success) {
        if (result?.sessionId) setRecoverySessionId(result.sessionId);
        if (result?.resultUnknown) {
          setDeviceInflight(await getLinklyInflightSession());
        }
        throw new Error(result?.error || "Refund failed");
      }

      setLastRefund(result.transaction);
      if (result.transaction?.sessionId) {
        setRecoverySessionId(result.transaction.sessionId);
      }
      setDeviceInflight(null);
      if (result.transaction?.success) {
        toast.success(
          `Refund approved · TxnRef ${result.transaction.txnRef || "—"}`,
        );
      } else {
        toast.error(
          result.transaction?.responseText?.trim() ||
            "Refund declined or not approved",
        );
      }
    } catch (error) {
      const message = error?.message || "Refund failed";
      setRefundError(message);
      toast.error(message);
      const inflight = await getLinklyInflightSession();
      setDeviceInflight(inflight);
      if (inflight?.sessionId) setRecoverySessionId(inflight.sessionId);
    } finally {
      setIsRefunding(false);
    }
  }

  /**
   * Accreditation 3.1 / 4.1 — GET session status or recover-last with optional backoff.
   */
  async function handleRecovery({ wait = false, recoverLast = false } = {}) {
    if (!isPaired) {
      toast.error("Pair the terminal before recovering a transaction");
      return;
    }

    const sessionId = String(recoverySessionId ?? "").trim();
    if (!recoverLast && !sessionId) {
      toast.error("Enter a sessionId, or use Recover last");
      return;
    }

    setIsRecovering(true);
    setRecoveryError("");
    setLastRecovery(null);

    try {
      const result = await queryLinklyTransactionStatus({
        sessionId: recoverLast ? undefined : sessionId,
        recoverLast,
        wait,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Recovery failed");
      }

      setLastRecovery(result);
      if (result.sessionId) setRecoverySessionId(result.sessionId);

      if (result.status === "complete" || result.status === "not_found") {
        setDeviceInflight(null);
        await syncCatalogFromServer({ ownerEmail: userData?.ownerEmail });
      } else {
        setDeviceInflight(await getLinklyInflightSession());
      }

      if (result.status === "complete" && result.transaction) {
        const txn = result.transaction;
        const outcome = txn.outcome || classifyLinklyTxnOutcome(txn);
        const approved =
          outcome === "approved" || outcome === "approved_signature";
        await setLinklyLastTxnOutcome({
          sessionId: txn.sessionId || result.sessionId,
          txnRef: txn.txnRef,
          outcome,
          success: Boolean(txn.success),
          responseCode: txn.responseCode,
          responseText: txn.responseText,
          amountCents: txn.amtPurchase || txn.requestedAmountCents,
          markedFailed: !approved,
          source: "settings-recovery",
        });
        setLastPosOutcome(await getLinklyLastTxnOutcome());

        try {
          await printLinklyTxnReceipt(txn, storeProfile || {}, {
            documentTitle: approved
              ? "CARD RECEIPT (RECOVERED)"
              : "CARD RESULT (FAILED)",
          });
        } catch {
          /* print optional in settings */
        }

        if (approved) {
          toast.success(
            `Recovered approved · TxnRef ${txn.txnRef || "—"}`,
          );
        } else {
          toast.error(
            `Marked failed · ${linklyOutcomeMessage(outcome, txn)}`,
          );
        }
      } else if (result.status === "not_found") {
        await setLinklyLastTxnOutcome({
          sessionId: result.sessionId,
          txnRef: null,
          outcome: "declined",
          success: false,
          responseCode: null,
          responseText: "Not found",
          amountCents: null,
          markedFailed: true,
          source: "settings-recovery",
        });
        setLastPosOutcome(await getLinklyLastTxnOutcome());
        toast.success("Not found — safe to retry with a new session");
      } else if (result.status === "unknown" || result.status === "in_progress") {
        toast.error(result.message || "Result still unknown — do not assume decline");
      } else {
        toast(result.message || `Status: ${result.status}`);
      }
    } catch (error) {
      const message = error?.message || "Recovery failed";
      setRecoveryError(message);
      toast.error(message);
    } finally {
      setIsRecovering(false);
    }
  }

  async function handleClearDeviceInflight() {
    await clearLinklyInflightSession();
    setDeviceInflight(null);
    toast.success("Cleared device in-flight session");
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          <div>
            <p className="text-sm text-neutral-500">
              <Link
                href="/settings"
                className="text-brand_accent hover:underline"
              >
                Settings
              </Link>
              <span className="mx-1.5">/</span>
              Linkly Cloud EFTPOS
            </p>
            <h1 className="mt-1 text-xl font-bold text-neutral-900 sm:text-2xl">
              Linkly Cloud EFTPOS
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Pair this store with a Linkly Cloud PIN pad or Virtual Pinpad
              (synchronous Cloud REST). Sync mode does not support live receipt
              events, display mirroring, or key-press cancel from the POS — the
              terminal completes the card flow, then Order Manager reads the
              final result (and recovers via session status if needed).
            </p>
          </div>

          {!dataLoaded ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
              Loading store settings…
            </div>
          ) : (
            <>
              {!savedLinkly.enabled ? (
                <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium">
                    Linkly is not enabled for this store
                  </p>
                  <p className="mt-1">
                    You can still pair a terminal here during development. Card
                    payments will only use Linkly once it is enabled for this
                    menu in Admin → POS → Payments.
                  </p>
                </section>
              ) : null}

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-neutral-900">
                      Terminal status
                    </h2>
                    {isPaired ? (
                      <StatusValue variant="success">Ready</StatusValue>
                    ) : (
                      <StatusValue variant="neutral">Not paired</StatusValue>
                    )}
                  </div>
                </div>
                <dl className="grid gap-3 px-6 py-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-neutral-500">Pairing</dt>
                    <dd>
                      {isPaired ? (
                        <StatusValue variant="success">Paired</StatusValue>
                      ) : (
                        <StatusValue variant="neutral">Not paired</StatusValue>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Last paired</dt>
                    <dd className="font-medium text-neutral-900">
                      {pairedAtLabel ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-emerald-600"
                            aria-hidden
                          />
                          {pairedAtLabel}
                        </span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Cloud username</dt>
                    <dd className="font-medium text-neutral-900">
                      {savedLinkly.username || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Environment</dt>
                    <dd className="font-medium text-neutral-900">
                      {savedLinkly.environment || "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-neutral-500">Pairing secret</dt>
                    <dd>
                      {isPaired ? (
                        <StatusValue variant="success">
                          Stored on server (not shown)
                        </StatusValue>
                      ) : (
                        <StatusValue variant="neutral">Not stored</StatusValue>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-3">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Pair terminal
                  </h2>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    On the Virtual Pinpad press <strong>FUNC</strong>, then{" "}
                    <strong>8880</strong>, then Enter to show a pair code. Use
                    your sandbox Cloud username and password from Linkly.
                  </p>
                </div>
                <div className="space-y-4 px-6 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm sm:col-span-2">
                      <span className="font-medium text-neutral-700">
                        Cloud username
                      </span>
                      <input
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        disabled={isPairing}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-neutral-700">
                        Cloud password
                      </span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={isPairing}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-neutral-700">
                        Pair code
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={pairCode}
                        onChange={(event) => setPairCode(event.target.value)}
                        disabled={isPairing}
                        placeholder="From VPP / terminal"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handlePair}
                      disabled={isPairing || isUnpairing}
                      className="rounded-md bg-brand_accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPairing
                        ? "Pairing…"
                        : isPaired
                          ? "Re-pair terminal"
                          : "Pair terminal"}
                    </button>

                    {isPaired ? (
                      <button
                        type="button"
                        onClick={handleUnpair}
                        disabled={isPairing || isUnpairing}
                        className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUnpairing ? "Clearing…" : "Clear pairing"}
                      </button>
                    ) : null}
                  </div>

                  {pairStatus || pairMessage ? (
                    <div className="text-sm">
                      {pairStatus === "success" ? (
                        <StatusValue variant="success">
                          {pairMessage || "Terminal paired"}
                        </StatusValue>
                      ) : pairStatus === "failure" ? (
                        <StatusValue variant="error">
                          {pairMessage || "Pairing failed"}
                        </StatusValue>
                      ) : pairStatus === "inProgress" ? (
                        <StatusValue variant="pending">
                          {pairMessage || "Pairing…"}
                        </StatusValue>
                      ) : (
                        <p className="text-neutral-600">
                          {pairMessage || pairStatus}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-3">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Test purchase
                  </h2>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    Runs token + sync purchase on easymenu against the paired
                    VPP. Does not mark an order paid — for sandbox /
                    accreditation only. Use $10.00 and leave incomplete for
                    60–90s to test operator timeout (TO). Stay on this screen
                    while the VPP prompts; a long wait is normal.
                  </p>
                </div>
                <div className="space-y-4 px-6 py-4">
                  {!isPaired ? (
                    <p className="text-sm text-amber-800">
                      Pair a terminal above before running a purchase.
                    </p>
                  ) : null}

                  <label className="block max-w-xs text-sm">
                    <span className="font-medium text-neutral-700">
                      Amount (AUD)
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={purchaseAmountDollars}
                      onChange={(event) =>
                        setPurchaseAmountDollars(event.target.value)
                      }
                      disabled={isPurchasing || !isPaired}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleTestPurchase}
                    disabled={isPurchasing || !isPaired || isPairing}
                    className="rounded-md bg-brand_accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPurchasing ? "Purchasing on terminal…" : "Run purchase"}
                  </button>

                  {purchaseError ? (
                    <StatusValue variant="error">{purchaseError}</StatusValue>
                  ) : null}

                  {lastPurchase ? (
                    <dl className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-neutral-500">Result</dt>
                        <dd>
                          {(() => {
                            const outcome =
                              lastPurchase.outcome ||
                              classifyLinklyTxnOutcome(lastPurchase);
                            if (outcome === "approved") {
                              return (
                                <StatusValue variant="success">
                                  Approved
                                </StatusValue>
                              );
                            }
                            if (outcome === "approved_signature") {
                              return (
                                <StatusValue variant="success">
                                  Approved · signature (08)
                                </StatusValue>
                              );
                            }
                            if (outcome === "operator_timeout") {
                              return (
                                <StatusValue variant="error">
                                  Operator timeout (TO)
                                </StatusValue>
                              );
                            }
                            return (
                              <StatusValue variant="error">
                                {lastPurchase.responseText?.trim() || "Declined"}
                              </StatusValue>
                            );
                          })()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">TxnRef</dt>
                        <dd className="font-mono font-medium text-neutral-900">
                          {lastPurchase.txnRef || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Amount (cents)</dt>
                        <dd className="font-medium text-neutral-900">
                          {lastPurchase.amtPurchase}
                          {lastPurchase.requestedAmountCents != null &&
                          lastPurchase.requestedAmountCents !==
                            lastPurchase.amtPurchase ? (
                            <span className="ml-1 text-xs text-neutral-500">
                              (requested {lastPurchase.requestedAmountCents})
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">RRN / RFN</dt>
                        <dd className="font-mono text-xs text-neutral-900">
                          {lastPurchase.rrn || "—"} / {lastPurchase.rfn || "—"}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-neutral-500">SessionId</dt>
                        <dd className="break-all font-mono text-xs text-neutral-700">
                          {lastPurchase.sessionId || "—"}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-3">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Test refund
                  </h2>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    Matched refund (`TxnType` R) using RFN from the original
                    purchase. VPP sandbox often returns empty
                    purchaseAnalysisData — if RFN is blank after purchase, ask
                    Linkly or paste an RFN when you have one. Does not change
                    order payment state.
                  </p>
                </div>
                <div className="space-y-4 px-6 py-4">
                  {!isPaired ? (
                    <p className="text-sm text-amber-800">
                      Pair a terminal above before running a refund.
                    </p>
                  ) : null}

                  {lastPurchase?.success && !lastPurchase.rfn ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      Last purchase had no RFN (common on VPP sandbox). Prefilled
                      with <span className="font-mono">{SANDBOX_REFUND_RFN_PLACEHOLDER}</span>{" "}
                      for development only — replace with a real RFN when the
                      terminal returns one.
                    </p>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="font-medium text-neutral-700">
                        Amount (AUD)
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={refundAmountDollars}
                        onChange={(event) =>
                          setRefundAmountDollars(event.target.value)
                        }
                        disabled={isRefunding || !isPaired}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-neutral-700">
                        RFN (from purchase)
                      </span>
                      <input
                        type="text"
                        autoComplete="off"
                        value={refundRfn}
                        onChange={(event) => setRefundRfn(event.target.value)}
                        disabled={isRefunding || !isPaired}
                        placeholder={`e.g. ${SANDBOX_REFUND_RFN_PLACEHOLDER}`}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestRefund}
                    disabled={
                      isRefunding ||
                      isPurchasing ||
                      !isPaired ||
                      isPairing ||
                      !String(refundRfn).trim()
                    }
                    className="rounded-md bg-brand_accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRefunding ? "Refunding on terminal…" : "Run refund"}
                  </button>

                  {refundError ? (
                    <StatusValue variant="error">{refundError}</StatusValue>
                  ) : null}

                  {lastRefund ? (
                    <dl className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-neutral-500">Result</dt>
                        <dd>
                          {lastRefund.success ? (
                            <StatusValue variant="success">Approved</StatusValue>
                          ) : (
                            <StatusValue variant="error">
                              {lastRefund.responseText?.trim() || "Declined"}
                            </StatusValue>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">TxnRef</dt>
                        <dd className="font-mono font-medium text-neutral-900">
                          {lastRefund.txnRef || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Amount (cents)</dt>
                        <dd className="font-medium text-neutral-900">
                          {lastRefund.amtPurchase}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">TxnType</dt>
                        <dd className="font-medium text-neutral-900">
                          {lastRefund.txnType || "R"}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-neutral-500">SessionId</dt>
                        <dd className="break-all font-mono text-xs text-neutral-700">
                          {lastRefund.sessionId || "—"}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-3">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Error recovery
                  </h2>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    Run a purchase for $10.00 and leave the VPP incomplete for
                    60–90s to capture operator timeout (TO / 2.1.3). Power-fail:
                    kill the app mid-purchase, reopen POS — auto-recover prints
                    a TxnRef slip (4.1.3) and marks FAILED on the POS banner
                    (3.1.2). Or use Recover last below after a failed sale.
                  </p>
                </div>
                <div className="space-y-4 px-6 py-4">
                  {!isPaired ? (
                    <p className="text-sm text-amber-800">
                      Pair a terminal above before running recovery.
                    </p>
                  ) : null}

                  <dl className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="text-neutral-500">Device in-flight</dt>
                      <dd className="break-all font-mono text-xs text-neutral-800">
                        {deviceInflight?.sessionId || "—"}
                        {deviceInflight?.kind ? (
                          <span className="ml-2 font-sans text-neutral-500">
                            ({deviceInflight.kind})
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Store pending</dt>
                      <dd className="break-all font-mono text-xs text-neutral-800">
                        {savedLinkly.pendingSessionId || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Store last</dt>
                      <dd className="break-all font-mono text-xs text-neutral-800">
                        {savedLinkly.lastSessionId || "—"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-neutral-500">
                        Last POS outcome (3.1.2)
                      </dt>
                      <dd className="text-sm text-neutral-900">
                        {lastPosOutcome ? (
                          <>
                            <span
                              className={
                                lastPosOutcome.markedFailed
                                  ? "font-semibold text-red-700"
                                  : "font-semibold text-emerald-700"
                              }
                            >
                              {lastPosOutcome.markedFailed
                                ? "FAILED"
                                : "OK"}{" "}
                              · {lastPosOutcome.outcome}
                            </span>
                            <span className="ml-2 font-mono text-xs text-neutral-600">
                              TxnRef {lastPosOutcome.txnRef || "—"}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>

                  <label className="block text-sm">
                    <span className="font-medium text-neutral-700">
                      SessionId
                    </span>
                    <input
                      type="text"
                      autoComplete="off"
                      value={recoverySessionId}
                      onChange={(event) =>
                        setRecoverySessionId(event.target.value)
                      }
                      disabled={isRecovering || !isPaired}
                      placeholder="Paste sessionId from last purchase / power-fail"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm text-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRecovery({ wait: false })}
                      disabled={
                        isRecovering ||
                        !isPaired ||
                        !String(recoverySessionId).trim()
                      }
                      className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Query status
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRecovery({ wait: true })}
                      disabled={
                        isRecovering ||
                        !isPaired ||
                        !String(recoverySessionId).trim()
                      }
                      className="rounded-md bg-brand_accent px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRecovering
                        ? "Recovering…"
                        : "Recover (backoff ≤3 min)"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleRecovery({ wait: true, recoverLast: true })
                      }
                      disabled={isRecovering || !isPaired}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Recover last
                    </button>
                    {deviceInflight?.sessionId ? (
                      <button
                        type="button"
                        onClick={handleClearDeviceInflight}
                        disabled={isRecovering}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear device in-flight
                      </button>
                    ) : null}
                  </div>

                  {recoveryError ? (
                    <StatusValue variant="error">{recoveryError}</StatusValue>
                  ) : null}

                  {lastRecovery ? (
                    <dl className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-neutral-500">Status</dt>
                        <dd className="font-medium text-neutral-900">
                          {lastRecovery.status || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Result</dt>
                        <dd>
                          {lastRecovery.status === "complete" ? (
                            lastRecovery.transaction?.success ? (
                              <StatusValue variant="success">
                                Approved
                              </StatusValue>
                            ) : (
                              <StatusValue variant="error">
                                {lastRecovery.transaction?.responseText?.trim() ||
                                  "Declined"}
                              </StatusValue>
                            )
                          ) : lastRecovery.status === "not_found" ? (
                            <StatusValue variant="success">
                              Not found (safe retry)
                            </StatusValue>
                          ) : (
                            <StatusValue variant="pending">
                              {lastRecovery.message || lastRecovery.status}
                            </StatusValue>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">TxnRef</dt>
                        <dd className="font-mono font-medium text-neutral-900">
                          {lastRecovery.transaction?.txnRef || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">HTTP</dt>
                        <dd className="font-medium text-neutral-900">
                          {lastRecovery.httpStatus ?? "—"}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-neutral-500">SessionId</dt>
                        <dd className="break-all font-mono text-xs text-neutral-700">
                          {lastRecovery.sessionId || "—"}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
