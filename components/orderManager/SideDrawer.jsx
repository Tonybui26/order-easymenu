"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/helper";

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
  const backdropKey = `${drawerKey}-backdrop`;

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
        <motion.button
          key={backdropKey}
          type="button"
          aria-label={ariaLabel ? `Close ${ariaLabel}` : "Close drawer"}
          className="fixed inset-0 bg-black/30"
          style={{ zIndex }}
          onClick={handleClose}
          disabled={closeDisabled}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      ) : null}

      {isOpen ? (
        <motion.aside
          key={drawerKey}
          role="dialog"
          aria-modal="true"
          aria-labelledby={showHeader && title ? titleId : undefined}
          aria-label={!showHeader || !title ? ariaLabel || title : undefined}
          className={cn(
            "fixed inset-y-0 flex flex-col shadow-2xl",
            isLeft ? "left-0" : "right-0",
            widthClassName,
            panelClassName,
            panelSafeArea,
          )}
          style={{ zIndex: zIndex + 10 }}
          initial={{ x: isLeft ? "-100%" : "100%" }}
          animate={{ x: 0 }}
          exit={{ x: isLeft ? "-100%" : "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
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
                  <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
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
              showHeader ? bodyClassName : "flex min-h-0 flex-1 flex-col",
              !showHeader && bodyClassName,
            )}
          >
            {children}
          </div>

          {footer ? (
            <div className="border-t border-neutral-200 px-5 py-4">{footer}</div>
          ) : null}
        </motion.aside>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
