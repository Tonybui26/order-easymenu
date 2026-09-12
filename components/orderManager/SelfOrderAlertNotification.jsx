"use client";

import { useEffect, useState } from "react";
import { QrCode, WifiOff } from "lucide-react";
import { cn } from "@/lib/helper";
import {
  formatNotificationTimeAgo,
  formatSelfOrderAlertPrimaryLabel,
} from "@/lib/pos/selfOrderAlertDisplay";

const TIME_AGO_TICK_MS = 30_000;

/**
 * Single macOS-style self-order notification card (presentational; motion lives in stack).
 * Pass no `onSend` for dismiss-only / connection alerts. Optional `onReload` for connection lost.
 */
export default function SelfOrderAlertNotification({
  title = "New Order",
  description: descriptionOverride,
  table,
  customerName,
  createdAt,
  sendLabel = "Send",
  kind = "order",
  onSend,
  onDismiss,
  onReload,
  isSending = false,
  isAutoSending = false,
  className,
}) {
  const description =
    descriptionOverride ??
    formatSelfOrderAlertPrimaryLabel({ table, customerName });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isConnection = kind === "connection";
  const hasSend = typeof onSend === "function";
  const hasReload = typeof onReload === "function";

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), TIME_AGO_TICK_MS);
    return () => window.clearInterval(id);
  }, [createdAt]);

  const timeAgo = formatNotificationTimeAgo(createdAt ?? nowMs, nowMs);
  const sendDisabled = isSending || !hasSend;
  // Auto-print keeps running after dismiss; only block dismiss during manual Send.
  const dismissDisabled = isSending && !isAutoSending;

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
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-[0.65rem] text-white shadow-sm",
            isConnection ? "bg-amber-600" : "bg-violet-600",
          )}
          aria-hidden
        >
          {isConnection ? (
            <WifiOff className="size-6" strokeWidth={2.25} />
          ) : (
            <QrCode className="size-6" strokeWidth={2.25} />
          )}
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
          <p className="mt-0.5 text-[15px] leading-snug text-neutral-900">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        {hasSend && typeof onDismiss === "function" ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={dismissDisabled}
            className="px-1 py-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Dismiss
          </button>
        ) : null}
        {hasSend ? (
          <button
            type="button"
            onClick={onSend}
            disabled={sendDisabled}
            className="flex-grow rounded-lg bg-[#984B28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7f3f22] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAutoSending
              ? "Auto sending…"
              : isSending
                ? "…"
                : sendLabel}
          </button>
        ) : (
          <>
            {typeof onDismiss === "function" ? (
              <button
                type="button"
                onClick={onDismiss}
                disabled={dismissDisabled}
                className={cn(
                  "rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  hasReload
                    ? "text-neutral-600 hover:bg-black/5 hover:text-neutral-900"
                    : "flex-grow bg-neutral-900 text-white hover:bg-neutral-800",
                )}
              >
                Dismiss
              </button>
            ) : null}
            {hasReload ? (
              <button
                type="button"
                onClick={onReload}
                className="flex-grow rounded-lg bg-[#984B28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7f3f22]"
              >
                Reload
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
