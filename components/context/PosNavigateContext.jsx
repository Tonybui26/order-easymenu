"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

const OVERLAY_DELAY_MS = 120;

const PosNavigateContext = createContext(null);

export function PosNavigateProvider({ children }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showOverlay, setShowOverlay] = useState(false);
  const guardRef = useRef(null);

  useEffect(() => {
    if (!isPending) {
      setShowOverlay(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowOverlay(true);
    }, OVERLAY_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isPending]);

  const setNavigationGuard = useCallback((guard) => {
    guardRef.current = typeof guard === "function" ? guard : null;
    return () => {
      if (guardRef.current === guard) guardRef.current = null;
    };
  }, []);

  const navigate = useCallback(
    async (href) => {
      const guard = guardRef.current;
      if (guard) {
        const allowed = await guard(href);
        if (!allowed) return;
      }
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  return (
    <PosNavigateContext.Provider
      value={{ navigate, isPending, setNavigationGuard }}
    >
      {children}
      {showOverlay ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/10"
          role="status"
          aria-live="polite"
          aria-label="Loading page"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
        </div>
      ) : null}
    </PosNavigateContext.Provider>
  );
}

export function usePosNavigate() {
  const context = useContext(PosNavigateContext);
  if (!context) {
    throw new Error("usePosNavigate must be used within PosNavigateProvider");
  }
  return context;
}
