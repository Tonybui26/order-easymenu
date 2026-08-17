"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchPosRegisterSession } from "@/lib/api/fetchApi";
import PosChromeHeader from "./PosChromeHeader";
import PosRegisterClose from "./PosRegisterClose";
import PosRegisterPayInOut from "./PosRegisterPayInOut";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";

const SESSION_TABS = [
  { id: "close", label: "Close Register" },
  { id: "pay-in-out", label: "Cash Pay In/Out" },
];

/**
 * POS register session screen — Close Register and Cash Pay In/Out tabs.
 */
export default function PosRegisterSession() {
  const router = useRouter();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const [activeTab, setActiveTab] = useState("close");
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setIsLoading(true);
      const result = await fetchPosRegisterSession();
      if (cancelled) return;

      if (!result.success) {
        toast.error(result.error || "Failed to load register session");
        router.replace("/pos");
        return;
      }

      if (!result.session) {
        router.replace("/pos/register");
        return;
      }

      setSession(result.session);
      setIsLoading(false);
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleSessionUpdated(nextSession) {
    setSession(nextSession);
  }

  const countsFinalised = Boolean(session?.countsFinalised);

  useEffect(() => {
    if (countsFinalised && activeTab === "pay-in-out") {
      setActiveTab("close");
    }
  }, [countsFinalised, activeTab]);

  if (isLoading || !session) {
    return (
      <div className="bg-darken_primary flex h-[100dvh] w-full flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-darken_primary flex h-[100dvh] w-full flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex shrink-0 justify-end px-4 pb-4 pt-2">
          <div className="flex shrink-0 space-x-1 rounded-xl bg-[#402e22] p-1 shadow-sm">
            {SESSION_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isDisabled = countsFinalised && tab.id === "pay-in-out";
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 xl:text-base ${
                    isActive
                      ? "bg-brand_accent text-white shadow-sm"
                      : isDisabled
                        ? "cursor-not-allowed text-white/35"
                        : "text-white hover:bg-gray-50 hover:text-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeTab === "close" ? (
            <PosRegisterClose
              session={session}
              onSessionUpdated={handleSessionUpdated}
            />
          ) : null}
          {activeTab === "pay-in-out" && !countsFinalised ? (
            <PosRegisterPayInOut
              session={session}
              onSessionUpdated={handleSessionUpdated}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
