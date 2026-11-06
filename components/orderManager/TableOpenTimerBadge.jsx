"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/helper";
import { formatTableOpenDuration } from "@/lib/pos/tableOpenDuration";

const LONG_OPEN_MS = 15 * 60 * 1000;

/** Live open-time clock, same rhythm as the held-order card timer. */
export default function TableOpenTimerBadge({ startedAt, className }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(startedAt).getTime();
  if (!startedAt || Number.isNaN(start)) return null;

  const elapsed = Math.max(0, now - start);
  const label = formatTableOpenDuration(startedAt, now);
  if (!label) return null;
  const isLongOpen = elapsed >= LONG_OPEN_MS;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xl font-semibold tabular-nums tracking-tight",
        isLongOpen
          ? "bg-amber-50 text-amber-800"
          : "bg-neutral-100 text-neutral-800",
        className,
      )}
      title="Time this table has been open"
      aria-label={`Open for ${label}`}
    >
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          isLongOpen ? "bg-amber-500" : "animate-pulse bg-emerald-500",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}
