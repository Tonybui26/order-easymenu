"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/helper";

const INITIAL_TOAST = {
  show: false,
  type: "error",
  message: "",
  id: null,
  retry: null,
};

export const PRINT_ERROR_TOAST_QUEUE_MAX = 5;

function createToastEntry(message, type = "error", retry = null) {
  return {
    show: true,
    type,
    message,
    id: Date.now() + Math.random(),
    retry,
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

export function useDismissibleToast() {
  const [toast, setToast] = useState(INITIAL_TOAST);

  const showToast = useCallback((message, type = "error", retry = null) => {
    setToast({
      show: true,
      type,
      message,
      id: Date.now() + Math.random(),
      retry,
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

  return (
    <div
      className={cn(
        "flex w-full max-w-md rounded-lg border p-4 shadow-lg",
        hasRetry
          ? "flex-col items-start justify-between gap-3 p-3"
          : "items-center justify-between",
        toast.type === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : toast.type === "success"
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-yellow-200 bg-yellow-50 text-yellow-800",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={hasRetry ? "text-sm" : "text-lg"}>
          {toast.type === "error"
            ? "❌"
            : toast.type === "success"
              ? "✅"
              : "⚠️"}
        </span>
        <span className="font-medium">{toast.message}</span>
      </div>
      {hasRetry ? (
        <div className="flex w-full shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isRetrying}
            className="w-28 rounded bg-[#947474] px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#947474] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full rounded bg-[#2d9453] px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRetrying ? "Retrying..." : "Print again"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-4 shrink-0 rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function DismissibleToastStack({
  toasts = [],
  onDismiss,
  onRetry,
  retryingToastId = null,
  className,
}) {
  if (!toasts.length) return null;

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-50 flex max-h-[min(70vh,calc(100dvh-2rem))] w-full max-w-md flex-col gap-2 overflow-y-auto",
        className,
      )}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-in slide-in-from-right-5"
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
        </div>
      ))}
    </div>
  );
}

export default function DismissibleToast({
  toast,
  onDismiss,
  onRetry,
  isRetrying = false,
  className,
}) {
  if (!toast?.show) return null;

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-50 animate-in slide-in-from-right-5",
        className,
      )}
    >
      <DismissibleToastCard
        toast={toast}
        onDismiss={onDismiss}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    </div>
  );
}
