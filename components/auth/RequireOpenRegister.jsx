"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMenuContext } from "@/components/context/MenuContext";
import { fetchPosRegisterSession } from "@/lib/api/fetchApi";

const AUTH_PUBLIC_PATHS = ["/signin", "/signup"];

/** Paths allowed while the POS register is closed (when posEnabled). */
function isRegisterGateExempt(pathname) {
  if (!pathname) return false;
  if (AUTH_PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname === "/lock") return true;
  if (pathname === "/") return true;
  if (pathname === "/pos/register") return true;
  if (
    pathname === "/printer-management" ||
    pathname.startsWith("/printer-management/")
  ) {
    return true;
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return true;
  }
  return false;
}

/**
 * When POS is enabled and no register session is open, force staff to
 * /pos/register before using POS features (except live orders, printers,
 * settings, and lock).
 */
export default function RequireOpenRegister({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const { menuConfig, dataLoaded } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const isExempt = isRegisterGateExempt(pathname);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      setIsAllowed(true);
      return;
    }
    if (!dataLoaded) return;

    if (!posEnabled || isExempt) {
      setIsAllowed(true);
      return;
    }

    let cancelled = false;
    setIsAllowed(false);

    async function checkRegister() {
      const result = await fetchPosRegisterSession();
      if (cancelled) return;

      const isOpen = Boolean(result.success && result.session);
      if (!isOpen) {
        router.replace("/pos/register");
        return;
      }
      setIsAllowed(true);
    }

    checkRegister();
    return () => {
      cancelled = true;
    };
  }, [dataLoaded, isExempt, pathname, posEnabled, router, status]);

  if (status === "loading" || (status === "authenticated" && !dataLoaded)) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  if (status === "authenticated" && posEnabled && !isExempt && !isAllowed) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  return children;
}
