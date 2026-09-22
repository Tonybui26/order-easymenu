"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { queryLinklyTransactionStatus } from "@/lib/api/fetchApi";
import { getLinklyInflightSession } from "@/lib/linkly/inflightSession";
import {
  getLinklyLastTxnOutcome,
  setLinklyLastTxnOutcome,
} from "@/lib/linkly/lastTxnOutcome";
import {
  classifyLinklyTxnOutcome,
  linklyOutcomeMessage,
} from "@/lib/linkly/txnOutcome";
import { printLinklyTxnReceipt } from "@/lib/printers/printLinklyTxnReceipt";
import { useMenuContext } from "@/components/context/MenuContext";
import { resolvePosPaymentsConfig } from "@/lib/pos/posPaymentsConfig";

/**
 * On POS mount: recover interrupted Linkly sessions (device inflight or store
 * pending), print a TxnRef result slip (4.1.3), and mark failed outcomes in
 * POS state (3.1.2).
 *
 * @param {boolean} enabled
 * @param {{ onOutcomeChange?: (outcome: object|null) => void }} [options]
 */
export function useLinklyInflightRecovery(enabled, options = {}) {
  const ranRef = useRef(false);
  const onOutcomeChangeRef = useRef(options.onOutcomeChange);
  onOutcomeChangeRef.current = options.onOutcomeChange;
  const { storeProfile, menuConfig } = useMenuContext();

  useEffect(() => {
    if (!enabled || ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    async function publishOutcome(record) {
      if (cancelled) return;
      onOutcomeChangeRef.current?.(
        record || (await getLinklyLastTxnOutcome()),
      );
    }

    async function recordAndPrint(txn, { markedFailed, source }) {
      const outcome = txn.outcome || classifyLinklyTxnOutcome(txn);
      txn.outcome = outcome;
      await setLinklyLastTxnOutcome({
        sessionId: txn.sessionId,
        txnRef: txn.txnRef,
        outcome,
        success: Boolean(txn.success),
        responseCode: txn.responseCode,
        responseText: txn.responseText,
        amountCents: txn.amtPurchase || txn.requestedAmountCents,
        markedFailed,
        source,
      });
      await publishOutcome();

      try {
        const printResult = await printLinklyTxnReceipt(
          txn,
          storeProfile || {},
          {
            documentTitle: markedFailed
              ? "CARD RESULT (FAILED)"
              : "CARD RECEIPT (RECOVERED)",
          },
        );
        if (printResult?.success) {
          toast.success(
            `Printed card result · TxnRef ${txn.txnRef || printResult.txnRef || "—"}`,
            { duration: 5000 },
          );
        } else {
          toast.error(
            printResult?.message ||
              "Could not print recovered card receipt — check receipt printer",
            { duration: 6000 },
          );
        }
      } catch (printError) {
        console.error("Linkly recovery print failed:", printError);
        toast.error("Could not print recovered card receipt", {
          duration: 6000,
        });
      }
    }

    async function handleStatusResult(result, fallbackSessionId) {
      if (!result?.success) {
        toast.error(result?.error || "Linkly recovery failed");
        return;
      }

      if (result.status === "complete" && result.transaction) {
        const txn = result.transaction;
        const outcome = txn.outcome || classifyLinklyTxnOutcome(txn);
        txn.outcome = outcome;
        const approved =
          outcome === "approved" || outcome === "approved_signature";

        await recordAndPrint(txn, {
          markedFailed: !approved,
          source: "pos-startup-recovery",
        });

        if (approved) {
          toast.success(
            `Recovered approved card · TxnRef ${txn.txnRef || "—"}`,
            { duration: 8000 },
          );
        } else {
          toast.error(
            `Marked failed · ${linklyOutcomeMessage(outcome, txn)}`,
            { duration: 8000 },
          );
        }
        return;
      }

      if (result.status === "not_found") {
        await setLinklyLastTxnOutcome({
          sessionId: result.sessionId || fallbackSessionId || null,
          txnRef: null,
          outcome: "declined",
          success: false,
          responseCode: null,
          responseText: "Interrupted session not found",
          amountCents: null,
          markedFailed: true,
          source: "pos-startup-recovery",
        });
        await publishOutcome();
        toast("Interrupted Linkly session not found — safe to retry card", {
          duration: 6000,
        });
        return;
      }

      toast.error(
        result.message ||
          "Linkly recovery unfinished — do not assume decline; check Settings → Linkly",
        { duration: 8000 },
      );
    }

    async function run() {
      // Seed banner from any prior failed outcome (3.1.2).
      const existing = await getLinklyLastTxnOutcome();
      if (!cancelled && existing?.markedFailed) {
        onOutcomeChangeRef.current?.(existing);
      }

      const inflight = await getLinklyInflightSession();
      const linkly = resolvePosPaymentsConfig(menuConfig).linkly;
      const pendingSessionId = String(linkly?.pendingSessionId || "").trim();

      let sessionId = inflight?.sessionId || "";
      let recoverLast = false;

      if (!sessionId && pendingSessionId) {
        // Device lost inflight prefs but store still has pending (power-fail).
        sessionId = pendingSessionId;
        recoverLast = true;
      }

      if (!sessionId && !recoverLast) return;
      if (cancelled) return;

      toast("Recovering interrupted Linkly payment…", { duration: 4000 });

      const result = await queryLinklyTransactionStatus(
        recoverLast && !inflight?.sessionId
          ? { recoverLast: true, wait: true }
          : { sessionId, wait: true },
      );

      if (cancelled) return;
      await handleStatusResult(result, sessionId || pendingSessionId);
    }

    run().catch((error) => {
      console.error("useLinklyInflightRecovery:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, storeProfile, menuConfig]);
}
