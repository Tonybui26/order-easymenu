"use client";

import { useState } from "react";
import PosChromeHeader from "./PosChromeHeader";
import PosRegisterClose from "./PosRegisterClose";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";

const SESSION_TABS = [
  { id: "close", label: "Close Register" },
  { id: "pay-in-out", label: "Cash Pay In/Out" },
];

/**
 * POS register session screen (UI only).
 * Tabbed Close Register and Cash Pay In/Out views.
 */
export default function PosRegisterSession() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const [activeTab, setActiveTab] = useState("close");

  return (
    <div className="bg-darken_primary flex h-[100dvh] w-full flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex shrink-0 justify-end px-4 pb-4 pt-2">
          <div className="flex shrink-0 space-x-1 rounded-xl bg-[#402e22] p-1 shadow-sm">
            {SESSION_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 xl:text-base ${
                    isActive
                      ? "bg-brand_accent text-white shadow-sm"
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
          {activeTab === "close" ? <PosRegisterClose /> : null}
        </div>
      </div>
    </div>
  );
}
