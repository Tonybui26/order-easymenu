"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/helper";

/**
 * Top-right search control for the POS menu panel.
 * Results are rendered by the parent in the main product grid.
 */
export default function PosMenuSearch({
  query = "",
  onQueryChange,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) setIsOpen(false);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  function handleClose() {
    onQueryChange?.("");
    setIsOpen(false);
  }

  function handleOpen() {
    if (disabled) return;
    setIsOpen(true);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="Search menu"
        onClick={handleOpen}
        disabled={disabled}
        className="absolute right-3 top-3 z-20 flex size-11 items-center justify-center rounded-full bg-white text-neutral-700 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-black/5 transition-colors hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Search size={22} strokeWidth={2} aria-hidden />
      </button>
    );
  }

  return (
    <div className="absolute right-3 top-3 z-20 flex w-[min(calc(100%-1.5rem),20rem)] items-center gap-2 rounded-full bg-white py-1.5 pl-4 pr-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
      <Search
        className="size-4 shrink-0 text-neutral-400"
        strokeWidth={2}
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
      />
      <button
        type="button"
        aria-label="Close search"
        onClick={handleClose}
        disabled={disabled}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 active:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <X size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
