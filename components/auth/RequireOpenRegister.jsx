"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMenuContext } from "@/components/context/MenuContext";
import { usePosRegisterSession } from "@/components/context/PosRegisterSessionContext";
import { isRegisterGateExempt } from "@/lib/pos/registerGate";

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
  const { isOpen, refreshRegisterSession } = usePosRegisterSession();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const isExempt = isRegisterGateExempt(pathname);
  const shouldGate =
    status === "authenticated" && dataLoaded && posEnabled && !isExempt;
  const initialFetchStartedRef = useRef(false);

  useEffect(() => {
    if (!shouldGate) {
      initialFetchStartedRef.current = false;
      return;
    }

    if (isOpen === false) {
      router.replace("/pos/register");
      return;
    }

    if (isOpen !== null) return;

    if (initialFetchStartedRef.current) return;
    initialFetchStartedRef.current = true;

    let cancelled = false;

    async function loadRegisterSession() {
      const result = await refreshRegisterSession();
      if (cancelled) return;

      if (!result.ok) {
        initialFetchStartedRef.current = false;
        return;
      }

      if (!result.isOpen) {
        router.replace("/pos/register");
      }
    }

    loadRegisterSession();
    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshRegisterSession, router, shouldGate]);

  if (status === "loading" || (status === "authenticated" && !dataLoaded)) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  if (shouldGate && isOpen === null) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  if (shouldGate && isOpen === false) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  return children;
}
