"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { queryLinklyTransactionStatus } from "@/lib/api/fetchApi";
import { getLinklyInflightSession } from "@/lib/linkly/inflightSession";

/**
 * On POS mount: if a Linkly session was left in-flight (power-fail / kill app
 * mid-purchase), poll GET transaction status with backoff and toast the result.
 * Does not auto-complete a sale — staff must re-take payment or apply the
 * recovered approval manually until order-level txn persistence lands.
 */
export function useLinklyInflightRecovery(enabled) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (!enabled || ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

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

      if (result.status === "complete") {
        if (result.transaction?.success) {
          toast.success(
            `Recovered approved card · TxnRef ${result.transaction.txnRef || "—"}`,
            { duration: 8000 },
          );
        } else {
          toast.error(
            result.transaction?.responseText?.trim() ||
              "Recovered: card not approved",
            { duration: 8000 },
          );
        }
        return;
      }

      if (result.status === "not_found") {
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
  }, [enabled]);
}
