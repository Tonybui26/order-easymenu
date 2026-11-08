"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { TriangleAlert } from "lucide-react";

/** Set true only to preview the banner without a new build. */
const FORCE_SHOW_VERSION_BANNER = false;

export default function VersionBanner() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(FORCE_SHOW_VERSION_BANNER);
  const [isDismissed] = useState(false);
  const initialBuildIdRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const isDismissedRef = useRef(false);
  const bannerRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    isDismissedRef.current = isDismissed;
  }, [isDismissed]);

  async function checkVersion() {
    try {
      const response = await fetch("/api/version", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const currentBuildId = data.buildId;

      console.log("currentBuildId", currentBuildId);
      // Set initial build ID on first check
      if (initialBuildIdRef.current === null) {
        initialBuildIdRef.current = currentBuildId;
        console.log("initialBuildIdRef", initialBuildIdRef.current);
        return;
      }
      // Show banner if build ID changed and not dismissed
      if (
        FORCE_SHOW_VERSION_BANNER ||
        (currentBuildId !== initialBuildIdRef.current &&
          !isDismissedRef.current)
      ) {
        setShowBanner(true);
      }
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.error("Version check failed:", error);
    }
  }

  useEffect(() => {
    // Initial check
    checkVersion();

    // Poll every 5 minutes
    pollIntervalRef.current = setInterval(() => {
      checkVersion();
      console.log(" polling version testing script");
    }, 300000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  function handleReload() {
    window.location.reload();
  }

  const isVisible =
    pathname !== "/customer-display" &&
    (showBanner || FORCE_SHOW_VERSION_BANNER);

  useEffect(() => {
    const root = document.documentElement;
    if (!isVisible) {
      root.style.setProperty("--version-banner-h", "0px");
      return;
    }

    const banner = bannerRef.current;
    if (!banner) return;

    function syncHeight() {
      root.style.setProperty(
        "--version-banner-h",
        `${banner.offsetHeight}px`,
      );
    }

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      root.style.setProperty("--version-banner-h", "0px");
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <style>{`
        .h-\\[100dvh\\] {
          height: calc(100dvh - var(--version-banner-h, 0px));
        }
        .min-h-\\[100dvh\\],
        .min-h-\\[100vh\\] {
          min-height: calc(100dvh - var(--version-banner-h, 0px));
        }
      `}</style>
      <button
        ref={bannerRef}
        type="button"
        onClick={handleReload}
        className="flex w-full shrink-0 items-center justify-center gap-2 bg-blue-600 px-3.5 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        <span className="truncate text-sm font-medium">
          Update available: Tap this banner to get the latest improvements.
        </span>
      </button>
    </>
  );
}
