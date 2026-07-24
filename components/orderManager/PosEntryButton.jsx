"use client";

import { MonitorSmartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMenuContext } from "@/components/context/MenuContext";

/**
 * Floating POS entry for stores with menu.config.posEnabled.
 */
export default function PosEntryButton() {
  const router = useRouter();
  const { menuConfig } = useMenuContext();

  if (!menuConfig?.posEnabled) return null;

  return (
    <button
      type="button"
      aria-label="Open POS"
      onClick={() => router.push("/pos")}
      className="fixed bottom-6 right-6 z-40 flex min-h-[88px] min-w-[88px] touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl bg-brand_accent px-5 py-4 text-white shadow-xl transition-transform active:scale-95 hover:bg-brand_accent/90"
    >
      <MonitorSmartphone size={36} strokeWidth={2.25} aria-hidden />
      <span className="text-base font-bold tracking-wide">POS</span>
    </button>
  );
}
