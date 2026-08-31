"use client";

import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { cn } from "@/lib/helper";
import {
  formatNotificationTimeAgo,
  formatSelfOrderAlertPrimaryLabel,
} from "@/lib/pos/selfOrderAlertDisplay";

const TIME_AGO_TICK_MS = 30_000;

/**
 * Single macOS-style self-order notification card (presentational; motion lives in stack).
 */
export default function SelfOrderAlertNotification({
  title = "New Order",
  description: descriptionOverride,
  table,
  customerName,
  createdAt,
  sendLabel = "Send",
  onSend,
  onCancel,
  onDismiss,
  isSending = false,
  className,
}) {
  const description =
    descriptionOverride ??
    formatSelfOrderAlertPrimaryLabel({ table, customerName });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), TIME_AGO_TICK_MS);
    return () => window.clearInterval(id);
  }, [createdAt]);

  const timeAgo = formatNotificationTimeAgo(createdAt ?? nowMs, nowMs);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={[title, description, timeAgo].filter(Boolean).join(". ")}
      className={cn(
        "w-full min-w-[300px] rounded-2xl border border-white/50 p-2.5",
        "bg-white/55 text-left backdrop-blur-xl backdrop-saturate-150",
        "shadow-[0_4px_14px_rgba(0,0,0,0.12),0_12px_36px_rgba(0,0,0,0.22),0_24px_56px_rgba(0,0,0,0.14)]",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[0.65rem] bg-violet-600 text-white shadow-sm"
          aria-hidden
        >
          <QrCode className="size-6" strokeWidth={2.25} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-semibold leading-snug text-neutral-900">
              {title}
            </p>
            <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-900">
              {timeAgo}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[15px] leading-snug text-neutral-900">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        {typeof onDismiss === "function" ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSending}
            className="px-1 py-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Dismiss
          </button>
        ) : null}
        {typeof onCancel === "function" ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSend}
          disabled={isSending || typeof onSend !== "function"}
          className="flex-grow rounded-lg bg-[#984B28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7f3f22] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "…" : sendLabel}
        </button>
      </div>
    </div>
  );
}
