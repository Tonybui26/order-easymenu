"use client";

import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";

export default function SettingsPage() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">
              Settings
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              App preferences and configuration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
