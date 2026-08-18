"use client";

import { cn } from "@/lib/helper";

const VARIANTS = {
  default: {
    on: "bg-brand_accent/15 text-brand_accent",
    off: "bg-neutral-200/80 text-neutral-500",
  },
  payment: {
    on: "bg-emerald-500/15 text-emerald-700",
    off: "bg-neutral-200/80 text-neutral-500",
  },
};

export default function SettingsOnOffBadge({
  checked = false,
  variant = "default",
}) {
  const colors = VARIANTS[variant] || VARIANTS.default;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        checked ? colors.on : colors.off,
      )}
    >
      {checked ? "On" : "Off"}
    </span>
  );
}
