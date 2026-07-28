"use client";

import { cn } from "@/lib/helper";

/**
 * Bottom banner when settings have unsaved local changes.
 */
export default function SettingsSaveBar({
  isVisible,
  isSaving = false,
  onSave,
  className,
}) {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="min-w-0 text-sm text-neutral-600">
          You have unsaved changes.
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="btn-primary btn shrink-0 px-6 disabled:cursor-not-allowed"
        >
          {isSaving ? "SAVING…" : "SAVE TO SERVER"}
        </button>
      </div>
    </div>
  );
}
