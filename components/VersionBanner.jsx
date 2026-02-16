"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw, X } from "lucide-react";

export default function VersionBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const initialBuildIdRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const isDismissedRef = useRef(false);

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
      
      // Set initial build ID on first check
      if (initialBuildIdRef.current === null) {
        initialBuildIdRef.current = currentBuildId;
        return;
      }
      
      // Show banner if build ID changed and not dismissed
      if (
        currentBuildId !== initialBuildIdRef.current &&
        !isDismissedRef.current
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
    
    // Poll every 60 seconds
    pollIntervalRef.current = setInterval(() => {
      checkVersion();
      console.log(" polling version testing script");
    }, 10000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  function handleReload() {
    window.location.reload();
  }

  function handleDismiss() {
    setShowBanner(false);
    setIsDismissed(true);
  }

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-lg">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5" />
            <p className="text-sm font-medium">
              A new version is available. Reload to update.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReload}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
            >
              Reload
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md hidden p-1.5 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

