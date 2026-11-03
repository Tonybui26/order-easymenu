"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import PosMenuLayoutView from "@/components/orderManager/posMenuLayout/PosMenuLayoutView";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";

export default function EditMenuPage() {
  const router = useRouter();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { menuConfig, dataLoaded } = useMenuContext();

  useEffect(() => {
    if (dataLoaded && !menuConfig?.posEnabled) {
      router.replace("/settings");
    }
  }, [dataLoaded, menuConfig, router]);

  if (!dataLoaded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  if (!menuConfig?.posEnabled) return null;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="btn btn-ghost btn-sm gap-1"
        >
          <ChevronLeft className="size-4" />
          Settings
        </button>
        <h1 className="text-lg font-semibold text-neutral-900">Edit Menu</h1>
      </div>
      <div className="min-h-0 flex-1">
        <PosMenuLayoutView />
      </div>
    </div>
  );
}
