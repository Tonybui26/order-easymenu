"use client";

import { useActiveOperator } from "@/components/context/ActiveOperatorContext";

function getStaffDisplayName(operator) {
  const name = String(operator?.name || "").trim();
  if (name) return name;

  const username = String(operator?.username || "").trim();
  if (username) return username;

  return "Staff";
}

/**
 * Current staff user + lock affordance (far right of POS chrome header).
 */
export default function PosHeaderUserPanel() {
  const { activeOperator, lock } = useActiveOperator();
  const displayName = getStaffDisplayName(activeOperator);

  return (
    <div className="flex shrink-0 flex-col items-end justify-center text-right">
      <span className="max-w-[7.5rem] truncate text-sm font-semibold leading-tight text-white sm:max-w-[9rem]">
        {displayName}
      </span>
      <button
        type="button"
        onClick={lock}
        className="mt-0.5 text-xs font-normal text-white/55 transition-colors hover:text-white/85 active:text-white"
      >
        Logout
      </button>
    </div>
  );
}
