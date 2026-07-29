"use client";

import { cn } from "@/lib/helper";

/**
 * Single boolean setting row for SystemSettings and future settings sections.
 */
export default function SettingsToggleRow({
  title,
  description,
  checked = false,
  onChange,
  disabled = false,
  className,
}) {
  function handleChange(event) {
    if (disabled) return;
    onChange?.(event.target.checked);
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 px-6 py-4 transition-colors duration-200",
        checked ? "bg-brand_accent/[0.1]" : "bg-neutral-50/50",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <h3
            className={cn(
              "text-base font-semibold uppercase tracking-wide",
              checked ? "text-neutral-900" : "text-neutral-500",
            )}
          >
            {title}
          </h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              checked
                ? "bg-brand_accent/15 text-brand_accent"
                : "bg-neutral-200/80 text-neutral-500",
            )}
          >
            {checked ? "On" : "Off"}
          </span>
        </span>
        <span
          className={cn(
            "mt-1 block text-base",
            checked ? "text-neutral-600" : "text-neutral-400",
          )}
        >
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="toggle toggle-primary toggle-lg shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
      />
    </label>
  );
}
