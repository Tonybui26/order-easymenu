"use client";

import { useSession } from "next-auth/react";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";

function getStaffDisplayName(userData, sessionUser) {
  const name = String(userData?.name || sessionUser?.name || "").trim();
  if (name) return name;

  const username = String(
    userData?.username || sessionUser?.username || "",
  ).trim();
  if (username) return username;

  return "Staff";
}

/**
 * Current staff user + logout affordance (far right of POS chrome header).
 * Logout action wired later.
 */
export default function PosHeaderUserPanel() {
  const { userData } = useGlobalAppContext();
  const { data: session } = useSession();
  const displayName = getStaffDisplayName(userData, session?.user);

  return (
    <div className="flex shrink-0 flex-col items-end justify-center text-right">
      <span className="max-w-[7.5rem] truncate text-sm font-semibold leading-tight text-white sm:max-w-[9rem]">
        {displayName}
      </span>
      <button
        type="button"
        onClick={() => {}}
        className="mt-0.5 text-xs font-normal text-white/55 transition-colors hover:text-white/85 active:text-white"
      >
        Logout
      </button>
    </div>
  );
}
