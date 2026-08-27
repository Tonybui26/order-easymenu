"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
} from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/helper";
import { formatPosItemDisplayName } from "@/lib/helper/printNameAlias";

const OPTION_WIDTH = 88;
const SWIPE_SPRING = { type: "spring", damping: 28, stiffness: 320 };
const OPEN_OFFSET = -OPTION_WIDTH;
const OPEN_THRESHOLD = OPTION_WIDTH * 0.35;
const OPEN_VELOCITY = -400;
/** WebViews often synthesize a click well after touchend; keep ignoring it. */
const POST_DRAG_CLICK_SUPPRESS_MS = 450;

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

/**
 * POS cart line with indented variant/modifier rows (design reference).
 * Highlight background only when the line is active/selected for editing.
 * Swipe left to reveal an OPTION action (notes / line options — UI first).
 */
export default function PosCartLine({
  line,
  isActive = false,
  readOnly = false,
  allowVoidSentLine = false,
  useKitchenPrintAliases = false,
  isOptionsOpen = false,
  onOptionsOpenChange,
  onOptionsClick,
  onSelect,
  onQtyClick,
  onRemoveLine,
  onVoidSentLine,
  onRemoveVariant,
  onRemoveModifier,
}) {
  const qty = line.quantity || 1;
  const basePrice = Number(line.basePrice ?? line.price ?? 0);
  const variants = line.selectedVariants || [];
  const modifiers = line.selectedModifiers || [];
  const hasChildren = variants.length > 0 || modifiers.length > 0;
  const isSentToKitchen = line.kitchenStatus === "sent";
  const isCancelled = line.kitchenStatus === "cancelled";
  const isLocked = readOnly || isSentToKitchen || isCancelled;
  const showVoidSentButton =
    allowVoidSentLine && isSentToKitchen && !isCancelled;
  const showRemoveUnsentButton = !readOnly && !isSentToKitchen && !isCancelled;
  const canSwipeOptions = !readOnly && !isCancelled;
  const strikeClass = isCancelled ? "line-through decoration-neutral-400" : "";
  const nameOptions = { useKitchenPrintAliases };
  const displayTitle =
    formatPosItemDisplayName(line.title, nameOptions) || "Untitled";

  const x = useMotionValue(0);
  const isOpenRef = useRef(false);
  const isDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef(null);
  const optionArmedRef = useRef(false);
  const lastOptionActivateAtRef = useRef(0);
  const [isRevealed, setIsRevealed] = useState(false);

  useMotionValueEvent(x, "change", (latest) => {
    isOpenRef.current = latest <= OPEN_OFFSET / 2;
  });

  useEffect(() => {
    if (!canSwipeOptions) {
      setIsRevealed(false);
      optionArmedRef.current = false;
      animate(x, 0, SWIPE_SPRING);
      return;
    }
    setIsRevealed(isOptionsOpen);
    optionArmedRef.current = isOptionsOpen;
    animate(x, isOptionsOpen ? OPEN_OFFSET : 0, SWIPE_SPRING);
  }, [canSwipeOptions, isOptionsOpen, x]);

  useEffect(() => {
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  function armPostDragClickSuppress() {
    suppressClickRef.current = true;
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressTimerRef.current = null;
    }, POST_DRAG_CLICK_SUPPRESS_MS);
  }

  function snapTo(open) {
    if (!canSwipeOptions) {
      setIsRevealed(false);
      optionArmedRef.current = false;
      animate(x, 0, SWIPE_SPRING);
      onOptionsOpenChange?.(false);
      return;
    }

    // Elevate Option immediately so the next tap hits the button, not the
    // sliding row (real-device spring still covers Option mid-animation).
    setIsRevealed(open);
    optionArmedRef.current = open;
    if (open) {
      x.set(OPEN_OFFSET);
    } else {
      animate(x, 0, SWIPE_SPRING);
    }
    onOptionsOpenChange?.(open);
  }

  function handleDragStart() {
    if (!canSwipeOptions) return;
    // While revealed, only tap-to-close — horizontal drag fights list scroll on device.
    if (isRevealed || isOptionsOpen || optionArmedRef.current) return;
    isDraggingRef.current = true;
    suppressClickRef.current = true;
  }

  function handleDragEnd(_, info) {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const shouldOpen =
      info.offset.x < -OPEN_THRESHOLD || info.velocity.x < OPEN_VELOCITY;
    snapTo(shouldOpen);
    armPostDragClickSuppress();
  }

  function handleContentActivate() {
    if (suppressClickRef.current || isDraggingRef.current) return;
    if (isRevealed || isOptionsOpen || isOpenRef.current) {
      snapTo(false);
      return;
    }
    if (!isLocked) onSelect?.(line.lineId);
  }

  function handleOptionActivate(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!optionArmedRef.current && !isRevealed && !isOptionsOpen) return;
    if (isDraggingRef.current) return;
    // pointerup + click both fire on some devices; only handle once.
    const now = performance.now();
    if (now - lastOptionActivateAtRef.current < 350) return;
    lastOptionActivateAtRef.current = now;
    onOptionsClick?.(line.lineId);
  }

  return (
    <li
      data-pos-cart-line-id={line.lineId}
      className={cn(
        "relative m-2 my-1 overflow-hidden rounded-xl border-2 border-[#f2f2f2] bg-white transition-colors",
        isActive ? "border-[#dcdcdc] drop-shadow-md" : "",
        isCancelled && "bg-neutral-50/80",
      )}
    >
      {canSwipeOptions ? (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex",
            // When revealed, sit above the sliding row so taps reach Option
            // even while the open spring is still settling.
            isRevealed ? "z-[3]" : "pointer-events-none z-0",
          )}
          style={{ width: OPTION_WIDTH }}
        >
          <button
            type="button"
            onPointerUp={handleOptionActivate}
            onClick={handleOptionActivate}
            className="flex h-full w-full flex-col items-center justify-center rounded-r-[0.75rem] bg-[#301C0F] px-2 text-center text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#3d2614] active:bg-[#24150b]"
            aria-label={`Options for ${displayTitle}`}
          >
            Option
          </button>
        </div>
      ) : null}

      <motion.div
        style={{ x: canSwipeOptions ? x : 0 }}
        drag={
          canSwipeOptions && !isRevealed && !isOptionsOpen ? "x" : false
        }
        dragConstraints={{ left: OPEN_OFFSET, right: 0 }}
        dragElastic={0.12}
        dragDirectionLock
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="relative z-[2] touch-pan-y rounded-[calc(0.75rem-2px)] bg-white"
      >
        {isSentToKitchen && !isCancelled ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-red-100/25"
            aria-hidden
          />
        ) : null}

        <div
          role={isLocked && !canSwipeOptions ? undefined : "button"}
          tabIndex={isLocked && !canSwipeOptions ? undefined : 0}
          onClick={handleContentActivate}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            handleContentActivate();
          }}
          className={cn(
            "relative z-[2] flex items-center gap-2.5 px-3 py-2.5",
            (!isLocked || canSwipeOptions) && "cursor-pointer",
            (isSentToKitchen || isCancelled) && "text-neutral-500",
          )}
          aria-label={
            isCancelled
              ? `${displayTitle}, voided`
              : isSentToKitchen
                ? `${displayTitle}, sent to kitchen`
                : undefined
          }
        >
          {isLocked ? (
            <span
              className={cn(
                "inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 px-2 text-sm font-bold text-neutral-800",
                strikeClass,
              )}
            >
              {qty}
            </span>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (isRevealed || isOptionsOpen) {
                  snapTo(false);
                  return;
                }
                onQtyClick?.(line.lineId);
              }}
              className="inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white px-2 text-sm font-bold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 active:bg-neutral-100"
              aria-label={`Edit quantity of ${displayTitle}`}
            >
              {qty}
            </button>
          )}

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-base font-medium text-neutral-800",
                strikeClass,
                isCancelled && "text-neutral-400",
              )}
            >
              {displayTitle}
            </p>
            {isCancelled && line.cancelReason ? (
              <p className="mt-0.5 truncate text-xs text-neutral-400">
                Voided: {line.cancelReason}
              </p>
            ) : null}
            {!isCancelled && line.notes ? (
              <p className="mt-0.5 truncate text-xs italic text-neutral-500">
                Note: {line.notes}
              </p>
            ) : null}
          </div>

          <span
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center rounded-md border-neutral-200 bg-white px-2 text-sm font-semibold tabular-nums text-neutral-800",
              strikeClass,
              isCancelled && "text-neutral-400",
            )}
          >
            {formatMoney(basePrice)}
          </span>

          {showVoidSentButton ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onVoidSentLine?.(line.lineId);
              }}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ef3636] text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
              aria-label={`Void ${displayTitle}`}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          ) : null}

          {showRemoveUnsentButton ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveLine?.(line.lineId);
              }}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ef3636] text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
              aria-label={`Remove ${displayTitle}`}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>

        {hasChildren ? (
          <ul
            className={cn(
              "relative z-[2] pb-1",
              (isSentToKitchen || isCancelled) && "text-neutral-500",
            )}
          >
            {variants.map((variant) => {
              const optionLabel =
                formatPosItemDisplayName(variant.optionName, nameOptions) ||
                variant.optionName;
              return (
                <li
                  key={`variant-${variant.groupName}-${variant.optionId}`}
                  className="flex items-center gap-2.5 py-1.5 pl-[3.25rem] pr-3"
                >
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm text-neutral-500",
                      strikeClass,
                    )}
                  >
                    {optionLabel}
                  </p>
                  <span className="w-12 shrink-0" aria-hidden />
                  {showRemoveUnsentButton ? (
                    <button
                      type="button"
                      onClick={() =>
                        onRemoveVariant?.(line.lineId, variant.optionId)
                      }
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ef3636] text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
                      aria-label={`Remove ${optionLabel}`}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  ) : null}
                </li>
              );
            })}

            {modifiers.map((modifier) => {
              const price = Number(modifier.priceModifier || 0);
              const optionLabel =
                formatPosItemDisplayName(modifier.optionName, nameOptions) ||
                modifier.optionName;
              return (
                <li
                  key={`modifier-${modifier.groupName}-${modifier.optionId}`}
                  className="flex items-center gap-2.5 py-1.5 pl-[3.25rem] pr-3"
                >
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm text-neutral-500",
                      strikeClass,
                    )}
                  >
                    {optionLabel}
                  </p>
                  {price > 0 ? (
                    <span
                      className={cn(
                        "min-w-[3rem] shrink-0 text-right text-sm tabular-nums text-neutral-600",
                        strikeClass,
                      )}
                    >
                      {formatMoney(price)}
                    </span>
                  ) : (
                    <span className="min-w-[3rem] shrink-0" aria-hidden />
                  )}
                  {showRemoveUnsentButton ? (
                    <button
                      type="button"
                      onClick={() =>
                        onRemoveModifier?.(line.lineId, modifier.optionId)
                      }
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ef3636] text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
                      aria-label={`Remove ${optionLabel}`}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </motion.div>
    </li>
  );
}
