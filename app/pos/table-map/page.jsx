"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMenuContext } from "@/components/context/MenuContext";
import PosTableMap from "@/components/orderManager/PosTableMap";

export default function PosTableMapPage() {
  const router = useRouter();
  const { menuConfig } = useMenuContext();

  useEffect(() => {
    if (menuConfig && !menuConfig.posEnabled) {
      router.replace("/");
    }
  }, [menuConfig, router]);

  if (!menuConfig?.posEnabled) {
    return null;
  }

  return <PosTableMap />;
}
