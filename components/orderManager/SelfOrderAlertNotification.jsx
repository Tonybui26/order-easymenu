"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QrCode } from "lucide-react";
import { cn } from "@/lib/helper";

const SLIDE_OFFSCREEN_X = "calc(100% + 1rem)";

const LINEAR_SLIDE = {
  type: "tween",
  duration: 0.25,
  ease: "linear",
};

/**
 * iOS-style banner: slides in from the top-right, one alert at a time.
 */
export default function SelfOrderAlertNotification({
  isOpen = false,
  title = "New order",
  subtitle = "",
  detail,
  onDismiss,
  autoDismissMs = 6000,
  className,
}) {
  useEffect(() => {
    if (!isOpen || !autoDismissMs || typeof onDismiss !== "function") return;

    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoDismissMs, onDismiss]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.button
          type="button"
          role="status"
          aria-live="polite"
          aria-label={[title, subtitle, detail].filter(Boolean).join(". ")}
          initial={{ x: SLIDE_OFFSCREEN_X }}
          animate={{ x: 0 }}
          exit={{ x: SLIDE_OFFSCREEN_X }}
          transition={LINEAR_SLIDE}
          onClick={onDismiss}
          className={cn(
            "fixed z-[70] max-w-[min(100vw-1.5rem,22rem)]",
            "right-[max(0.75rem,env(safe-area-inset-right))]",
            "top-[max(0.75rem,env(safe-area-inset-top))]",
            "flex items-start gap-3 rounded-2xl border border-white/60",
            "bg-white px-3.5 py-3 text-left shadow-[0_8px_32px_rgba(0,0,0,0.18)]",
            "ring-1 ring-black/5",
            "transition-transform active:scale-[0.98]",
            className,
          )}
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm"
            aria-hidden
          >
            <QrCode className="size-5" strokeWidth={2.25} />
          </span>

          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block truncate text-[13px] font-semibold leading-tight text-neutral-900">
              {title}
            </span>
            {subtitle ? (
              <span className="mt-0.5 block truncate text-[13px] leading-snug text-neutral-600">
                {subtitle}
              </span>
            ) : null}
            {detail ? (
              <span className="mt-1 block truncate text-xs font-medium text-neutral-500">
                {detail}
              </span>
            ) : null}
          </span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
