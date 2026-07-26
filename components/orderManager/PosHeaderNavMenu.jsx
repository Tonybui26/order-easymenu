"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Folder,
  MonitorSmartphone,
  Printer,
  QrCode,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/helper";

const NAV_ITEMS = [
  {
    id: "pos",
    label: "Point of Sale",
    description: "Counter point of sale",
    href: "/pos",
    Icon: MonitorSmartphone,
  },
  {
    id: "held",
    label: "Held Orders",
    description: "Parked tickets waiting to resume",
    href: "/pos/held",
    Icon: Folder,
  },
  {
    id: "live-orders",
    label: "Live Orders",
    description: "Kitchen & QR tickets",
    href: "/",
    Icon: QrCode,
  },
  {
    id: "printers",
    label: "Printers",
    description: "Receipt printer setup",
    href: "/printer-management",
    Icon: Printer,
  },
];

function resolveActiveItem(pathname) {
  if (pathname === "/pos/held" || pathname?.startsWith("/pos/held/")) {
    return NAV_ITEMS.find((item) => item.id === "held") || NAV_ITEMS[0];
  }
  if (pathname === "/pos" || pathname?.startsWith("/pos/")) {
    return NAV_ITEMS.find((item) => item.id === "pos") || NAV_ITEMS[0];
  }
  if (pathname === "/printer-management") {
    return NAV_ITEMS.find((item) => item.id === "printers") || NAV_ITEMS[0];
  }
  if (pathname === "/") {
    return NAV_ITEMS.find((item) => item.id === "live-orders") || NAV_ITEMS[0];
  }
  return NAV_ITEMS[0];
}

/**
 * Feature switcher for the POS header (far right).
 * Icon + stacked labels + chevron; shaded to merge with the dark header.
 */
export default function PosHeaderNavMenu({ className }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  const current = resolveActiveItem(pathname);

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

  function handleSelect(item) {
    setIsOpen(false);
    if (item.id === current.id) return;
    router.push(item.href);
  }

  return (
    <div ref={rootRef} className={cn("relative z-50", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Switch feature"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex min-h-[44px] min-w-[200px] max-w-[min(100%,16rem)] items-center gap-2.5 rounded-2xl bg-white/[0.08] px-2.5 py-1.5 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] active:bg-white/[0.16] sm:gap-3 sm:px-1.5 sm:py-1",
          isOpen && "bg-white/[0.14] ring-white/15",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand_accent/15 text-white sm:size-10">
          <current.Icon size={20} strokeWidth={2} aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight text-white sm:text-sm">
            {current.label}
          </span>
        </span>

        <ChevronDown
          size={18}
          strokeWidth={2}
          className={cn(
            "shrink-0 text-white/45 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="pos-nav-menu"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(calc(100vw-2rem),18rem)] origin-top-right overflow-hidden rounded-2xl bg-[#3d2618] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === current.id;
              const Icon = item.Icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                    isActive
                      ? "bg-brand_accent/15"
                      : "hover:bg-white/[0.06] active:bg-white/[0.1]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl",
                      isActive
                        ? "bg-brand_accent/20 text-brand_accent"
                        : "bg-white/[0.06] text-white/70",
                    )}
                  >
                    <Icon size={18} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm font-semibold leading-tight",
                        isActive ? "text-brand_accent" : "text-white",
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/45">
                      {item.description}
                    </span>
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
