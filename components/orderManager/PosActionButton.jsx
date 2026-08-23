"use client";

import { cn } from "@/lib/helper";

/** Shared tone classes for POS primary / more-action buttons. */
export const POS_ACTION_TONE = {
  blue: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
  teal: "bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800",
  green: "bg-green-600 text-white hover:bg-green-700 active:bg-green-800",
  purple: "bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800",
  red: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};

/**
 * Shared POS action button (drawer footer, more-actions sheet, held cards).
 * Matches the expand-sheet style: text-base, centered label, optional icon.
 */
export default function PosActionButton({
  children,
  icon: Icon,
  tone,
  className,
  disabled = false,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold tracking-wide transition-colors",
        tone ? POS_ACTION_TONE[tone] : null,
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon size={16} strokeWidth={2} aria-hidden /> : null}
      {children}
    </button>
  );
}
