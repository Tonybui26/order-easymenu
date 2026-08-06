"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/helper";

/**
 * Reusable select dropdown (same interaction pattern as PosHeaderNavMenu).
 * Icons and description taglines are optional — omit them for a simple filter control.
 *
 * @param {{
 *   options: Array<{ id: string, label: string, description?: string, Icon?: import("lucide-react").LucideIcon }>,
 *   value: string,
 *   onChange: (id: string) => void,
 *   placeholder?: string,
 *   ariaLabel?: string,
 *   showIcons?: boolean,
 *   showDescriptions?: boolean,
 *   variant?: "light" | "dark",
 *   className?: string,
 *   menuClassName?: string,
 * }} props
 */
export default function DropdownSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select…",
  ariaLabel = "Select option",
  showIcons = false,
  showDescriptions = false,
  variant = "light",
  className,
  menuClassName,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const selected =
    options.find((option) => option.id === value) || options[0] || null;
  const SelectedIcon = selected?.Icon;
  const isDark = variant === "dark";

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(option) {
    setIsOpen(false);
    if (option.id === value) return;
    onChange?.(option.id);
  }

  return (
    <div ref={rootRef} className={cn("relative z-40", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex min-h-[46px] w-full items-center justify-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
          isDark
            ? cn(
                "rounded-2xl bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.12] active:bg-white/[0.16]",
                isOpen && "bg-white/[0.14] ring-white/15",
              )
            : cn(
                "rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-[0.2rem] focus:ring-brand_accent/30 focus:ring-offset-1",
                isOpen && "border-brand_accent/40",
              ),
        )}
      >
        {showIcons && SelectedIcon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              isDark
                ? "bg-brand_accent/15 text-white"
                : "bg-neutral-100 text-neutral-700",
            )}
          >
            <SelectedIcon size={16} strokeWidth={2} aria-hidden />
          </span>
        ) : null}

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-medium leading-tight",
              isDark ? "text-white" : "text-neutral-900",
            )}
          >
            {selected?.label || placeholder}
          </span>
          {showDescriptions && selected?.description ? (
            <span
              className={cn(
                "mt-0.5 block truncate text-xs",
                isDark ? "text-white/45" : "text-neutral-500",
              )}
            >
              {selected.description}
            </span>
          ) : null}
        </span>

        <ChevronDown
          size={16}
          strokeWidth={2}
          className={cn(
            "shrink-0 transition-transform duration-200",
            isDark ? "text-white/45" : "text-neutral-400",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="dropdown-select-menu"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute right-0 top-[calc(100%+0.35rem)] w-full min-w-[12rem] origin-top-right overflow-hidden p-1.5 shadow-lg",
              isDark
                ? "rounded-2xl bg-[#3d2618] shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
                : "rounded-lg border border-gray-200 bg-white",
              menuClassName,
            )}
          >
            {options.map((option) => {
              const isActive = option.id === value;
              const Icon = option.Icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                    isDark
                      ? isActive
                        ? "bg-brand_accent/15"
                        : "hover:bg-white/[0.06] active:bg-white/[0.1]"
                      : isActive
                        ? "bg-brand_accent/10"
                        : "hover:bg-neutral-50 active:bg-neutral-100",
                  )}
                >
                  {showIcons && Icon ? (
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        isDark
                          ? isActive
                            ? "bg-brand_accent/20 text-brand_accent"
                            : "bg-white/[0.06] text-white/70"
                          : isActive
                            ? "bg-brand_accent/15 text-brand_accent"
                            : "bg-neutral-100 text-neutral-600",
                      )}
                    >
                      <Icon size={16} strokeWidth={2} aria-hidden />
                    </span>
                  ) : null}

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm font-medium leading-tight",
                        isDark
                          ? isActive
                            ? "text-brand_accent"
                            : "text-white"
                          : isActive
                            ? "text-brand_accent"
                            : "text-neutral-900",
                      )}
                    >
                      {option.label}
                    </span>
                    {showDescriptions && option.description ? (
                      <span
                        className={cn(
                          "mt-0.5 block truncate text-xs",
                          isDark ? "text-white/45" : "text-neutral-500",
                        )}
                      >
                        {option.description}
                      </span>
                    ) : null}
                  </span>

                  {isActive ? (
                    <Check
                      size={16}
                      strokeWidth={2.5}
                      className="shrink-0 text-brand_accent"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
