"use client";

/**
 * POS banner when the last Linkly card attempt was marked failed (3.1.2).
 */
export default function LinklyFailedSaleBanner({
  outcome,
  onDismiss,
  onReprint,
  isReprintPending = false,
}) {
  if (!outcome?.markedFailed) return null;

  return (
    <div className="mx-3 mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-950 shadow-sm sm:mx-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Last Linkly card sale: FAILED</p>
          <p className="mt-0.5 text-red-900/90">
            {outcome.outcome === "operator_timeout"
              ? "Operator timeout (TO) — sale incomplete."
              : outcome.responseText ||
                outcome.outcome ||
                "Card not approved — sale incomplete."}
            {outcome.txnRef ? (
              <>
                {" "}
                <span className="font-mono text-xs">
                  TxnRef {outcome.txnRef}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onReprint && outcome.txnRef ? (
            <button
              type="button"
              onClick={onReprint}
              disabled={isReprintPending}
              className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
            >
              {isReprintPending ? "Printing…" : "Reprint"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
