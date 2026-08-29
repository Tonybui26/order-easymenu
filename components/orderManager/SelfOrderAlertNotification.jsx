"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QrCode } from "lucide-react";
import { cn } from "@/lib/helper";
import {
  formatNotificationTimeAgo,
  formatSelfOrderAlertPrimaryLabel,
} from "@/lib/pos/selfOrderAlertDisplay";

/** Fully off-screen right (element is `fixed` + `right:` anchored). */
const OFFSCREEN_X = "calc(100% + 1rem)";

/** Same spring as held-order action sheet (PosHeldOrderCard). */
const ALERT_SPRING = {
  type: "spring",
  damping: 28,
  stiffness: 320,
};

const ALERT_VARIANTS = {
  hidden: { x: OFFSCREEN_X },
  visible: {
    x: 0,
    transition: ALERT_SPRING,
  },
  exit: {
    x: OFFSCREEN_X,
    transition: ALERT_SPRING,
  },
};

const TIME_AGO_TICK_MS = 30_000;

/**
 * macOS-style notification banner (top-right).
 * Bold title, table/customer description, relative time top-right, Send at bottom-right.
 */
export default function SelfOrderAlertNotification({
  isOpen = false,
  title = "New Order",
  table,
  customerName,
  createdAt,
  onSend,
  onDismiss,
  isSending = false,
  className,
}) {
  const description = formatSelfOrderAlertPrimaryLabel({ table, customerName });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;

    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), TIME_AGO_TICK_MS);
    return () => window.clearInterval(id);
  }, [isOpen, createdAt]);

  const timeAgo = formatNotificationTimeAgo(createdAt ?? nowMs, nowMs);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          role="status"
          aria-live="polite"
          aria-label={[title, description, timeAgo].filter(Boolean).join(". ")}
          variants={ALERT_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(
            "fixed z-[70] w-[min(100vw-1.5rem,22rem)] min-w-[300px]",
            "right-[max(0.75rem,env(safe-area-inset-right))]",
            "top-[max(0.75rem,env(safe-area-inset-top))]",
            "rounded-2xl bg-[#ebebeb] p-2.5",
            "text-left shadow-[0_4px_24px_rgba(0,0,0,0.12)]",
            "will-change-transform",
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
                <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-400">
                  {timeAgo}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[15px] leading-snug text-neutral-600">
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
            <button
              type="button"
              onClick={onSend}
              disabled={isSending || typeof onSend !== "function"}
              className="flex-grow rounded-lg bg-[#984B28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7f3f22] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? "…" : "Send"}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
