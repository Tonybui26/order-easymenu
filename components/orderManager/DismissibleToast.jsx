"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/helper";

const INITIAL_TOAST = {
  show: false,
  type: "error",
  message: "",
  id: null,
};

export function useDismissibleToast() {
  const [toast, setToast] = useState(INITIAL_TOAST);

  const showToast = useCallback((message, type = "error") => {
    setToast({
      show: true,
      type,
      message,
      id: Date.now() + Math.random(),
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast(INITIAL_TOAST);
  }, []);

  return { toast, showToast, hideToast };
}

export default function DismissibleToast({ toast, onDismiss, className }) {
  if (!toast?.show) return null;

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-50 animate-in slide-in-from-right-5",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full max-w-md items-center justify-between rounded-lg border p-4 shadow-lg",
          toast.type === "error"
            ? "border-red-200 bg-red-50 text-red-800"
            : toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-yellow-200 bg-yellow-50 text-yellow-800",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-lg">
            {toast.type === "error"
              ? "❌"
              : toast.type === "success"
                ? "✅"
                : "⚠️"}
          </span>
          <span className="font-medium">{toast.message}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-4 shrink-0 rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
