"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { useClickOutside } from "@/lib/hooks/clickOutSide";
import { useSkipInitialEffect } from "@/lib/hooks/useSkipInitialEffect";
import { cn } from "@/lib/helper";

const DropDownList = forwardRef(function DropDownList(
  {
    options = [],
    value,
    onChange,
    className,
    placeholder = "Choose an option",
    menuChildren,
    triggerLabel,
    summarySlot,
    onOpenChange,
    summaryClassName,
    summaryId,
    disabled = false,
    menuListClassName,
    summarySlotClassName,
  },
  forwardedRef,
) {
  const detailsRef = useRef(null);

  useImperativeHandle(forwardedRef, () => ({
    close: () => detailsRef.current?.removeAttribute("open"),
    open: () => {
      if (detailsRef.current) detailsRef.current.setAttribute("open", "");
    },
  }));

  useClickOutside(detailsRef, () => {
    if (detailsRef.current) {
      detailsRef.current.removeAttribute("open");
    }
  });

  const isCustomMenu = Boolean(menuChildren);

  useSkipInitialEffect(() => {
    if (detailsRef.current && !isCustomMenu) {
      detailsRef.current.removeAttribute("open");
    }
  }, [value, isCustomMenu]);

  const hasCustomLabel =
    typeof triggerLabel === "string"
      ? triggerLabel.trim().length > 0
      : Boolean(triggerLabel);

  const displayText = isCustomMenu
    ? summarySlot
      ? placeholder
      : hasCustomLabel
        ? triggerLabel
        : placeholder
    : value
      ? (() => {
          const selectedOption = options.find((r) => r.id === value);
          return selectedOption?.name ?? placeholder;
        })()
      : placeholder;

  return (
    <details
      className={cn(
        "dropdown",
        className,
        disabled && "pointer-events-none opacity-50",
      )}
      ref={detailsRef}
      onToggle={(e) => {
        if (!disabled) onOpenChange?.(e.currentTarget.open);
      }}
    >
      <summary
        id={summaryId}
        className={cn(
          "btn h-10 min-h-10 w-full justify-between border-gray-200 bg-white text-left hover:bg-gray-100 hover:text-black",
          summaryClassName,
        )}
      >
        {summarySlot ? (
          <span
            className={cn(
              "flex min-w-0 flex-1 items-center pr-2",
              summarySlotClassName,
            )}
          >
            {summarySlot}
          </span>
        ) : (
          <span
            className={cn(
              "text-sm font-medium",
              isCustomMenu && !hasCustomLabel && "text-gray-400",
              !value && !isCustomMenu && "font-normal text-gray-500",
            )}
          >
            {displayText}
          </span>
        )}
        <svg
          className="h-4 w-4 shrink-0 fill-current opacity-70"
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
        </svg>
      </summary>
      <ul
        tabIndex={0}
        className={cn(
          "menu dropdown-content z-[9999] w-auto min-w-full flex-col flex-nowrap rounded-box bg-white p-2 shadow-lg",
          menuListClassName,
        )}
      >
        {menuChildren ??
          options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onChange(option.id)}
                className={cn(
                  "py-3 text-left",
                  value === option.id
                    ? "bg-gray-100 text-gray-900"
                    : "hover:bg-gray-100",
                )}
              >
                <div className="flex flex-col text-nowrap">
                  <span className="font-medium">{option.name}</span>
                  {option.description && (
                    <span className="text-xs opacity-70">
                      {option.description}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
      </ul>
    </details>
  );
});

export default DropDownList;
