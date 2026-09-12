"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/helper";
import { formatNotificationTimeAgo } from "@/lib/pos/selfOrderAlertDisplay";

const TIME_AGO_TICK_MS = 30_000;

const OFFSCREEN_X = "calc(100% + 1rem)";

const SLIDE_SPRING = {
  type: "spring",
  damping: 28,
  stiffness: 320,
};

const STACK_LAYOUT_SPRING = {
  type: "spring",
  damping: 28,
  stiffness: 320,
};

const ALERT_ITEM_VARIANTS = {
  hidden: { x: OFFSCREEN_X, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      x: SLIDE_SPRING,
      opacity: { duration: 0.2, ease: "easeOut" },
    },
  },
  exit: {
    x: OFFSCREEN_X,
    opacity: 0,
    transition: {
      x: SLIDE_SPRING,
      opacity: { duration: 0.15, ease: "easeIn" },
    },
  },
};

const INITIAL_TOAST = {
  show: false,
  type: "error",
  message: "",
  id: null,
  retry: null,
  createdAt: null,
};

export const PRINT_ERROR_TOAST_QUEUE_MAX = 5;

function createToastEntry(message, type = "error", retry = null) {
  return {
    show: true,
    type,
    message,
    id: Date.now() + Math.random(),
    retry,
    createdAt: Date.now(),
  };
}

function getToastOrderId(retry) {
  const orderId = retry?.order?._id;
  return orderId ? String(orderId) : null;
}

function mergeToastEntry(existing, message, type, retry) {
  return {
    ...existing,
    message,
    type,
    retry: retry ?? existing.retry,
    createdAt: existing.createdAt ?? Date.now(),
  };
}

function enqueueToastEntry(queue, message, type = "error", retry = null) {
  const orderId = getToastOrderId(retry);

  if (orderId) {
    const index = queue.findIndex(
      (entry) => getToastOrderId(entry.retry) === orderId,
    );
    if (index >= 0) {
      const next = [...queue];
      next[index] = mergeToastEntry(next[index], message, type, retry);
      return next;
    }
  }

  const next = [...queue, createToastEntry(message, type, retry)];
  if (next.length > PRINT_ERROR_TOAST_QUEUE_MAX) {
    return next.slice(next.length - PRINT_ERROR_TOAST_QUEUE_MAX);
  }
  return next;
}

function getToastTitle(toast, hasRetry) {
  if (hasRetry) return "Print failed";
  if (toast.type === "success") return "Success";
  if (toast.type === "warning") return "Notice";
  return "Error";
}

function getToastIconMeta(toast, hasRetry) {
  if (hasRetry || (toast.type === "error" && /print/i.test(toast.message || ""))) {
    return { Icon: Printer, iconClass: "bg-rose-600" };
  }
  if (toast.type === "success") {
    return { Icon: CheckCircle2, iconClass: "bg-emerald-600" };
  }
  if (toast.type === "warning") {
    return { Icon: AlertTriangle, iconClass: "bg-amber-600" };
  }
  return { Icon: AlertCircle, iconClass: "bg-rose-600" };
}

export function useDismissibleToast() {
  const [toast, setToast] = useState(INITIAL_TOAST);

  const showToast = useCallback((message, type = "error", retry = null) => {
    setToast({
      show: true,
      type,
      message,
      id: Date.now() + Math.random(),
      retry,
      createdAt: Date.now(),
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast(INITIAL_TOAST);
  }, []);

  return { toast, showToast, hideToast };
}

export function useDismissibleToastQueue() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "error", retry = null) => {
    setToasts((prev) => enqueueToastEntry(prev, message, type, retry));
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((entry) => entry.id !== toastId));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return { toasts, showToast, dismissToast, clearToasts };
}

function DismissibleToastCard({
  toast,
  onDismiss,
  onRetry,
  isRetrying = false,
}) {
  const hasRetry = Boolean(toast.retry?.order && typeof onRetry === "function");
  const title = getToastTitle(toast, hasRetry);
  const { Icon, iconClass } = getToastIconMeta(toast, hasRetry);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const createdAt = toast.createdAt ?? toast.id ?? Date.now();

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), TIME_AGO_TICK_MS);
    return () => window.clearInterval(id);
  }, [createdAt]);

  const timeAgo = formatNotificationTimeAgo(createdAt, nowMs);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={[title, toast.message, timeAgo].filter(Boolean).join(". ")}
      className={cn(
        "w-full min-w-[300px] rounded-2xl border border-white/50 p-2.5",
        "bg-white/55 text-left backdrop-blur-xl backdrop-saturate-150",
        "shadow-[0_4px_14px_rgba(0,0,0,0.12),0_12px_36px_rgba(0,0,0,0.22),0_24px_56px_rgba(0,0,0,0.14)]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-[0.65rem] text-white shadow-sm",
            iconClass,
          )}
          aria-hidden
        >
          <Icon className="size-6" strokeWidth={2.25} />
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
            {toast.message}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        {hasRetry ? (
          <>
            <button
              type="button"
              onClick={onDismiss}
              disabled={isRetrying}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-black/5 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="flex-grow rounded-lg bg-[#984B28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7f3f22] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRetrying ? "Retrying…" : "Print again"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-grow rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

const STACK_POSITION_CLASS =
  "pointer-events-none fixed z-[70] right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex w-[min(100vw-1.5rem,22rem)] min-w-[300px] max-h-[min(70vh,calc(100dvh-2rem))] flex-col gap-2 overflow-y-auto";

export function DismissibleToastStack({
  toasts = [],
  onDismiss,
  onRetry,
  retryingToastId = null,
  className,
}) {
  return (
    <LayoutGroup id="dismissible-toast-stack">
      <div
        className={cn(STACK_POSITION_CLASS, className)}
        aria-hidden={toasts.length === 0}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout="position"
              variants={ALERT_ITEM_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ layout: STACK_LAYOUT_SPRING }}
              className="pointer-events-auto w-full will-change-transform"
            >
              <DismissibleToastCard
                toast={toast}
                onDismiss={() => onDismiss(toast.id)}
                onRetry={
                  typeof onRetry === "function"
                    ? () => onRetry(toast.id)
                    : undefined
                }
                isRetrying={retryingToastId === toast.id}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

export default function DismissibleToast({
  toast,
  onDismiss,
  onRetry,
  isRetrying = false,
  className,
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[70]",
        "right-[max(0.75rem,env(safe-area-inset-right))]",
        "top-[max(0.75rem,env(safe-area-inset-top))]",
        "w-[min(100vw-1.5rem,22rem)] min-w-[300px]",
        className,
      )}
      aria-hidden={!toast?.show}
    >
      <AnimatePresence initial={false}>
        {toast?.show ? (
          <motion.div
            key={toast.id ?? "dismissible-toast"}
            variants={ALERT_ITEM_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="pointer-events-auto w-full will-change-transform"
          >
            <DismissibleToastCard
              toast={toast}
              onDismiss={onDismiss}
              onRetry={onRetry}
              isRetrying={isRetrying}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
