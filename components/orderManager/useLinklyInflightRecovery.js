"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { queryLinklyTransactionStatus } from "@/lib/api/fetchApi";
import { getLinklyInflightSession } from "@/lib/linkly/inflightSession";
import { setLinklyLastTxnOutcome } from "@/lib/linkly/lastTxnOutcome";
import {
  classifyLinklyTxnOutcome,
  linklyOutcomeMessage,
} from "@/lib/linkly/txnOutcome";
import { printLinklyTxnReceipt } from "@/lib/printers/printLinklyTxnReceipt";
import { useMenuContext } from "@/components/context/MenuContext";

/**
 * On POS mount: if a Linkly session was left in-flight (power-fail / kill app
 * mid-purchase), poll GET transaction status with backoff, print a result
 * receipt (4.1.3), and mark failed outcomes in POS state (3.1.2).
 *
 * Does not auto-complete a sale — staff must re-take payment or apply a
 * recovered approval manually until order-level txn persistence lands.
 */
export function useLinklyInflightRecovery(enabled) {
  const ranRef = useRef(false);
  const { storeProfile } = useMenuContext();

  useEffect(() => {
    if (!enabled || ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

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
        if (!printResult?.success) {
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

    async function run() {
      const inflight = await getLinklyInflightSession();
      if (!inflight?.sessionId || cancelled) return;

      toast("Recovering interrupted Linkly payment…", { duration: 4000 });

      const result = await queryLinklyTransactionStatus({
        sessionId: inflight.sessionId,
        wait: true,
      });

      if (cancelled) return;

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
            `Recovered as failed · ${linklyOutcomeMessage(outcome, txn)}`,
            { duration: 8000 },
          );
        }
        return;
      }

      if (result.status === "not_found") {
        await setLinklyLastTxnOutcome({
          sessionId: inflight.sessionId,
          txnRef: null,
          outcome: "declined",
          success: false,
          responseCode: null,
          responseText: "Interrupted session not found",
          amountCents: inflight.amountCents,
          markedFailed: true,
          source: "pos-startup-recovery",
        });
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

    run().catch((error) => {
      console.error("useLinklyInflightRecovery:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, storeProfile]);
}
