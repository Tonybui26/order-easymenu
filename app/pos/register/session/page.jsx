"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMenuContext } from "@/components/context/MenuContext";
import PosRegisterSession from "@/components/orderManager/PosRegisterSession";

export default function PosRegisterSessionPage() {
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

  return <PosRegisterSession />;
}
