"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMenuContext } from "@/components/context/MenuContext";
import PosTerminal from "@/components/orderManager/PosTerminal";

export default function PosPage() {
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

  return (
    <Suspense fallback={null}>
      <PosTerminal />
    </Suspense>
  );
}
