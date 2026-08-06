"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/helper";
import { formatPosItemDisplayName } from "@/lib/helper/printNameAlias";

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

/**
 * POS cart line with indented variant/modifier rows (design reference).
 * Highlight background only when the line is active/selected for editing.
 */
export default function PosCartLine({
  line,
  isActive = false,
  readOnly = false,
  allowVoidSentLine = false,
  useKitchenPrintAliases = false,
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
  const strikeClass = isCancelled ? "line-through decoration-neutral-400" : "";
  const nameOptions = { useKitchenPrintAliases };
  const displayTitle =
    formatPosItemDisplayName(line.title, nameOptions) || "Untitled";

  return (
    <li
      className={cn(
        "relative m-2 my-1 rounded-xl border-2 border-[#f2f2f2] bg-white transition-colors",
        isActive ? "border-[#dcdcdc] drop-shadow-md" : "",
        isCancelled && "bg-neutral-50/80",
      )}
    >
      {isSentToKitchen && !isCancelled ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-red-100/25"
          aria-hidden
        />
      ) : null}

      <div
        role={isLocked ? undefined : "button"}
        tabIndex={isLocked ? undefined : 0}
        onClick={() => {
          if (!isLocked) onSelect?.(line.lineId);
        }}
        onKeyDown={(event) => {
          if (isLocked) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect?.(line.lineId);
          }
        }}
        className={cn(
          "relative z-[2] flex items-center gap-2.5 px-3 py-2.5",
          !isLocked && "cursor-pointer",
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
    </li>
  );
}
