"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMenuContext } from "@/components/context/MenuContext";
import PosTableMap from "@/components/orderManager/PosTableMap";
import { isRestaurantModeEnabled } from "@/lib/pos/posConfig";

export default function PosTableMapPage() {
  const router = useRouter();
  const { menuConfig } = useMenuContext();

  useEffect(() => {
    if (!menuConfig) return;
    if (!menuConfig.posEnabled) {
      router.replace("/");
      return;
    }
    if (!isRestaurantModeEnabled(menuConfig)) {
      router.replace("/pos");
    }
  }, [menuConfig, router]);

  if (!menuConfig?.posEnabled || !isRestaurantModeEnabled(menuConfig)) {
    return null;
  }

  return <PosTableMap />;
}
