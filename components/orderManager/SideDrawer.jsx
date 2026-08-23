"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/helper";

const BACKDROP_VARIANTS = {
  open: { opacity: 1 },
  closed: { opacity: 0 },
};

/**
 * Shared Order Manager side drawer shell (portal + backdrop + slide panel).
 * Feature drawers own content; this owns layout and motion.
 */
export default function SideDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer = null,
  footerClassName,
  /**
   * Dim + zoom header/body so the footer stands out (matches held / live order cards).
   * Click dismisses via onBodyOverlayClick.
   */
  bodyOverlay = false,
  onBodyOverlayClick,
  /** Spring slide-up panel over the zoomed body (held / live order card pattern). */
  bottomSlidePanel = null,
  side = "right",
  widthClassName = "w-[min(100%,28rem)]",
  panelClassName = "bg-white",
  bodyClassName = "px-5 py-4",
  /** Backdrop z-index; panel uses backdrop + 10. */
  zIndex = 60,
  closeDisabled = false,
  /** When false, no title bar — children fill the panel (e.g. POS keypad). */
  showHeader = true,
  ariaLabel,
  contentKey,
}) {
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const [portalReady, setPortalReady] = useState(false);
  const isLeft = side === "left";
  const drawerKey = contentKey || `${reactId}-drawer`;

  const panelVariants = {
    open: { x: 0 },
    closed: { x: isLeft ? "-100%" : "100%" },
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!portalReady) return null;

  function handleClose() {
    if (!closeDisabled) onClose?.();
  }

  const panelSafeArea = isLeft
    ? "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]"
    : "pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]";

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key={drawerKey}
          className="fixed inset-0"
          style={{ zIndex }}
          initial="closed"
          animate="open"
          exit="closed"
        >
          <motion.button
            type="button"
            aria-label={ariaLabel ? `Close ${ariaLabel}` : "Close drawer"}
            className="absolute inset-0 bg-black/30"
            variants={BACKDROP_VARIANTS}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={handleClose}
            disabled={closeDisabled}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={showHeader && title ? titleId : undefined}
            aria-label={!showHeader || !title ? ariaLabel || title : undefined}
            className={cn(
              "absolute inset-y-0 flex flex-col shadow-2xl",
              isLeft ? "left-0" : "right-0",
              widthClassName,
              panelClassName,
              panelSafeArea,
            )}
            style={{ zIndex: 10 }}
            variants={panelVariants}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <motion.div
                animate={{
                  opacity: bodyOverlay ? 0.35 : 1,
                  scale: bodyOverlay ? 0.98 : 1,
                }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col origin-center",
                  bodyOverlay && "pointer-events-none",
                )}
              >
                {showHeader ? (
                  <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                    <div className="min-w-0">
                      {title ? (
                        <h2
                          id={titleId}
                          className="text-lg font-bold text-neutral-900"
                        >
                          {title}
                        </h2>
                      ) : null}
                      {subtitle ? (
                        <p className="mt-1 text-sm text-neutral-500">
                          {subtitle}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={closeDisabled}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-50"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : null}

                <div
                  className={cn(
                    "min-h-0 flex-1 overflow-y-auto",
                    showHeader
                      ? bodyClassName
                      : "flex min-h-0 flex-1 flex-col",
                    !showHeader && bodyClassName,
                  )}
                >
                  {children}
                </div>
              </motion.div>

              <AnimatePresence>
                {bodyOverlay ? (
                  <motion.button
                    key={`${drawerKey}-body-overlay`}
                    type="button"
                    aria-label="Dismiss overlay"
                    className="absolute inset-0 z-10 bg-black/20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    onClick={() => onBodyOverlayClick?.()}
                  />
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {bottomSlidePanel ? (
                  <motion.div
                    key={`${drawerKey}-bottom-slide`}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 28, stiffness: 320 }}
                    className="absolute inset-x-0 bottom-0 z-20 border-t border-neutral-100 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
                  >
                    {bottomSlidePanel}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {footer ? (
              <div
                className={cn(
                  "relative z-20 border-t border-neutral-200 bg-white px-5 py-4",
                  footerClassName,
                )}
              >
                {footer}
              </div>
            ) : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
