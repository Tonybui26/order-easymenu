"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/helper";

/**
 * Plain text input — matches easymenu admin InputText for consistent forms/search.
 */
const InputText = forwardRef(function InputText(
  { type = "text", className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-[0.2rem] focus:ring-brand_accent/30 focus:ring-offset-1",
        className,
      )}
      {...props}
    />
  );
});

InputText.displayName = "InputText";

export default InputText;
