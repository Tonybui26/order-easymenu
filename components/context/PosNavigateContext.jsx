"use client";

import {
  createContext,
  useContext,
  useEffect,
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

  function navigate(href) {
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <PosNavigateContext.Provider value={{ navigate, isPending }}>
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
