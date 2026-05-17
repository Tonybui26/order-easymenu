"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function OrderCardAccordion({
  title,
  isOpen,
  onToggle,
  children,
  className = "",
  contentClassName = "border-t border-[#d9d9d9] py-3",
}) {
  return (
    <div className={className}>
      <div className="px-4 py-1 xl:px-6">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:text-gray-800"
          aria-expanded={isOpen}
        >
          <span>{title}</span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="inline-flex shrink-0"
            aria-hidden
          >
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key={`${title}-panel`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className={contentClassName}>{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
