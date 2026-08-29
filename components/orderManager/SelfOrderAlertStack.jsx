"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { cn } from "@/lib/helper";
import SelfOrderAlertNotification from "./SelfOrderAlertNotification";

/** Fully off-screen right for slide-in / slide-out. */
const OFFSCREEN_X = "calc(100% + 1rem)";

/** Slide reveal — same spring as held-order action sheet. */
const SLIDE_SPRING = {
  type: "spring",
  damping: 28,
  stiffness: 320,
};

/** Push existing alerts down when a new one is inserted on top. */
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

/**
 * Stacked self-order alerts (newest first) fixed to the top-right.
 *
 * @param {Array<{
 *   id: string,
 *   title?: string,
 *   table?: string,
 *   customerName?: string,
 *   createdAt?: number | string | Date,
 *   isSending?: boolean,
 * }>} alerts — newest entries first
 */
export default function SelfOrderAlertStack({
  alerts = [],
  onDismiss,
  onSend,
  className,
}) {
  return (
    <LayoutGroup id="self-order-alert-stack">
      <div
        className={cn(
          "pointer-events-none fixed z-[70]",
          "right-[max(0.75rem,env(safe-area-inset-right))]",
          "top-[max(0.75rem,env(safe-area-inset-top))]",
          "flex w-[min(100vw-1.5rem,22rem)] min-w-[300px] flex-col gap-2",
          className,
        )}
        aria-hidden={alerts.length === 0}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              layout="position"
              variants={ALERT_ITEM_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ layout: STACK_LAYOUT_SPRING }}
              className="pointer-events-auto w-full will-change-transform"
            >
              <SelfOrderAlertNotification
                title={alert.title}
                table={alert.table}
                customerName={alert.customerName}
                createdAt={alert.createdAt}
                isSending={alert.isSending}
                onDismiss={
                  typeof onDismiss === "function"
                    ? () => onDismiss(alert.id)
                    : undefined
                }
                onSend={
                  typeof onSend === "function"
                    ? () => onSend(alert.id)
                    : undefined
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
