"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMenuContext } from "@/components/context/MenuContext";
import PosRegister from "@/components/orderManager/PosRegister";

export default function PosRegisterPage() {
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

  return <PosRegister />;
}
