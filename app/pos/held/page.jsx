"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMenuContext } from "@/components/context/MenuContext";
import PosHeldOrders from "@/components/orderManager/PosHeldOrders";

export default function PosHeldOrdersPage() {
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

  return <PosHeldOrders />;
}
