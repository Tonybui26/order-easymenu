"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import { useMenuContext } from "@/components/context/MenuContext";
import { isStaffPinLockEnabled } from "@/lib/staff/staffRoles";

const AUTH_PUBLIC_PATHS = ["/signin", "/signup"];

export default function RequireActiveOperator({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const { hydrated, activeOperator } = useActiveOperator();
  const { menuConfig, dataLoaded } = useMenuContext();
  const pinLockEnabled = isStaffPinLockEnabled(menuConfig);

  const isAuthPublicPath = AUTH_PUBLIC_PATHS.includes(pathname);
  const isLockPath = pathname === "/lock";

  useEffect(() => {
    if (isAuthPublicPath || status !== "authenticated") return;
    if (!dataLoaded || !hydrated) return;

    if (!pinLockEnabled) {
      if (isLockPath) router.replace("/");
      return;
    }

    if (!isLockPath && !activeOperator) router.replace("/lock");
  }, [
    activeOperator,
    dataLoaded,
    hydrated,
    isAuthPublicPath,
    isLockPath,
    pinLockEnabled,
    router,
    status,
  ]);

  if (isAuthPublicPath) return children;

  if (status === "loading" || !hydrated || (status === "authenticated" && !dataLoaded)) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  if (!pinLockEnabled) return children;

  if (isLockPath) return children;

  if (status === "authenticated" && !activeOperator) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  return children;
}
