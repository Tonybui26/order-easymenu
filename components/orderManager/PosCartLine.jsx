"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/helper";

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
  onSelect,
  onQtyClick,
  onRemoveLine,
  onRemoveVariant,
  onRemoveModifier,
}) {
  const qty = line.quantity || 1;
  const basePrice = Number(line.basePrice ?? line.price ?? 0);
  const variants = line.selectedVariants || [];
  const modifiers = line.selectedModifiers || [];
  const hasChildren = variants.length > 0 || modifiers.length > 0;
  const isSentToKitchen = line.kitchenStatus === "sent";

  return (
    <li
      className={cn(
        "relative border-b border-neutral-100 transition-colors",
        isActive ? "bg-[#f4f7fb]" : "bg-white",
      )}
    >
      {isSentToKitchen ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-neutral-300/25"
          aria-hidden
        />
      ) : null}

      <div
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        onClick={() => {
          if (!readOnly) onSelect?.(line.lineId);
        }}
        onKeyDown={(event) => {
          if (readOnly) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect?.(line.lineId);
          }
        }}
        className={cn(
          "relative z-[2] flex items-center gap-2.5 px-3 py-2.5",
          !readOnly && "cursor-pointer",
          isSentToKitchen && "text-neutral-500",
        )}
        aria-label={
          isSentToKitchen ? `${line.title}, sent to kitchen` : undefined
        }
      >
        {readOnly ? (
          <span className="inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 px-2 text-sm font-bold text-neutral-800">
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
            aria-label={`Edit quantity of ${line.title}`}
          >
            {qty}
          </button>
        )}

        <p className="min-w-0 flex-1 text-base font-medium text-neutral-800">
          {line.title}
        </p>

        <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white px-2 text-sm font-semibold tabular-nums text-neutral-800">
          {formatMoney(basePrice)}
        </span>

        {!readOnly ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveLine?.(line.lineId);
            }}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#ef3636] text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
            aria-label={`Remove ${line.title}`}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      {hasChildren ? (
        <ul className={cn("relative z-[2] pb-1", isSentToKitchen && "text-neutral-500")}>
          {variants.map((variant) => (
            <li
              key={`variant-${variant.groupName}-${variant.optionId}`}
              className="flex items-center gap-2.5 py-1.5 pl-[3.25rem] pr-3"
            >
              <p className="min-w-0 flex-1 truncate text-sm text-neutral-500">
                {variant.optionName}
              </p>
              <span className="w-12 shrink-0" aria-hidden />
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => onRemoveVariant?.(line.lineId, variant.optionId)}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#ef3636] text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
                  aria-label={`Remove ${variant.optionName}`}
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              ) : null}
            </li>
          ))}

          {modifiers.map((modifier) => {
            const price = Number(modifier.priceModifier || 0);
            return (
              <li
                key={`modifier-${modifier.groupName}-${modifier.optionId}`}
                className="flex items-center gap-2.5 py-1.5 pl-[3.25rem] pr-3"
              >
                <p className="min-w-0 flex-1 truncate text-sm text-neutral-500">
                  {modifier.optionName}
                </p>
                {price > 0 ? (
                  <span className="min-w-[3rem] shrink-0 text-right text-sm tabular-nums text-neutral-600">
                    {formatMoney(price)}
                  </span>
                ) : (
                  <span className="min-w-[3rem] shrink-0" aria-hidden />
                )}
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() =>
                      onRemoveModifier?.(line.lineId, modifier.optionId)
                    }
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#ef3636] text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
                    aria-label={`Remove ${modifier.optionName}`}
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
