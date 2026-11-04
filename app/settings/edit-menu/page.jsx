"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import PosChromeHeader from "@/components/orderManager/PosChromeHeader";
import PosMenuLayoutView from "@/components/orderManager/posMenuLayout/PosMenuLayoutView";
import { usePosOpenCashDrawer } from "@/components/orderManager/usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import { canEditPosMenu } from "@/lib/staff/staffRoles";

export default function EditMenuPage() {
  const router = useRouter();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { menuConfig, dataLoaded } = useMenuContext();
  const { activeOperator, hydrated: operatorHydrated } = useActiveOperator();
  const canEditMenu =
    dataLoaded &&
    operatorHydrated &&
    canEditPosMenu(menuConfig, activeOperator);

  useEffect(() => {
    if (!dataLoaded || !operatorHydrated) return;
    if (!canEditMenu) router.replace("/settings");
  }, [canEditMenu, dataLoaded, operatorHydrated, router]);

  if (!dataLoaded || !operatorHydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  if (!canEditMenu) return null;

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
