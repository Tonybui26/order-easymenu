"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { usePosNavigate } from "@/components/context/PosNavigateContext";
import {
  Folder,
  Monitor,
  PanelBottomOpen,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useGlobalAppContext } from "@/components/context/GlobalAppContext";
import { useMenuContext } from "@/components/context/MenuContext";
import { getPosHomePath } from "@/lib/pos/posConfig";
import PosHeaderNavMenu from "./PosHeaderNavMenu";
import PosHeaderUserPanel from "./PosHeaderUserPanel";
import Logo from "../../public/images/logo.svg";
import { reloadAppWithCatalogSync } from "@/lib/localDb/catalogForceSync";
import {
  getHeldOffTableAlert,
  getHeldOffTableAlertServer,
  subscribeHeldOffTableAlert,
} from "@/lib/pos/heldOffTableAlert";

const POS_HEADER_ACTIONS = [
  {
    id: "support",
    label: "Support",
    hidden: true,
  },
  {
    id: "sync",
    label: "Sync",
    Icon: RefreshCw,
  },
  {
    id: "held",
    label: "Held Orders",
    Icon: Folder,
    href: "/pos/held",
    requiresPos: true,
  },
  {
    id: "kds",
    label: "KSD",
    Icon: Monitor,
    href: "/",
    enableKitchenDisplay: true,
  },
  {
    id: "cash-drawer",
    label: "Open drawer",
    Icon: PanelBottomOpen,
    requiresPos: true,
  },
  {
    id: "print",
    label: "Printer",
    Icon: Printer,
    href: "/settings?section=printers",
  },
];

const POS_TABLE_MAP_PATH = "/pos/table-map";

/**
 * Shared POS chrome header: EasyMenu logo, shortcut icons, feature switcher.
 * @param {{ onLogoClick?: () => void, onOpenCashDrawer?: () => void }} props
 */
export default function PosChromeHeader({ onLogoClick, onOpenCashDrawer }) {
  const { navigate } = usePosNavigate();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { menuConfig } = useMenuContext();
  const { kitchenDisplayEnabled, setKitchenDisplayEnabled } =
    useGlobalAppContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const hasOffTableHeld = useSyncExternalStore(
    subscribeHeldOffTableAlert,
    getHeldOffTableAlert,
    getHeldOffTableAlertServer,
  );
  const homePath = posEnabled ? getPosHomePath(menuConfig) : "/";
  const logoAriaLabel =
    homePath === POS_TABLE_MAP_PATH ? "Table map" : "Point of sale";

  const headerActions = POS_HEADER_ACTIONS.filter(
    (action) => !action.hidden && (!action.requiresPos || posEnabled),
  );

  function handleLogoClick() {
    onLogoClick?.();
    if (pathname !== homePath) {
      navigate(homePath);
    }
  }

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 bg-[#301C0F] px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={handleLogoClick}
        aria-label={logoAriaLabel}
        className="flex items-center gap-1.5 rounded-lg transition-colors active:bg-white/10"
      >
        <Image
          src={Logo}
          alt=""
          aria-hidden
          className="size-8 xl:size-8"
          priority
        />
        <span className="font-brand text-[1.4rem] font-extrabold text-white">
          Easy<span className="text-brand_accent">Menu</span>
        </span>
      </button>

      <div className="flex items-center gap-3 sm:gap-6">
        {headerActions.map(
          ({ id, label, Icon, href, enableKitchenDisplay }) => {
            const isActive =
              id === "print"
                ? pathname === "/settings" &&
                  searchParams.get("section") === "printers"
                : id === "kds"
                  ? pathname === "/" && kitchenDisplayEnabled
                  : href &&
                    (pathname === href ||
                      (href !== "/" && pathname?.startsWith(href)));
            const showAlert = id === "held" && hasOffTableHeld;

            return (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  if (id === "cash-drawer") {
                    onOpenCashDrawer?.();
                    return;
                  }
                  if (id === "sync") {
                    void reloadAppWithCatalogSync();
                    return;
                  }
                  if (enableKitchenDisplay) {
                    setKitchenDisplayEnabled(true);
                  }
                  if (href) navigate(href);
                }}
                className={`relative flex size-10 items-center justify-center rounded-xl border border-transparent transition-colors active:bg-black/25 sm:size-11 ${
                  isActive
                    ? "bg-brand_accent/25 text-brand_accent"
                    : "bg-brand_accent/10 text-white"
                }`}
              >
                <Icon size={24} strokeWidth={1.5} />
                {showAlert && (
                  <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center">
                    <span
                      aria-hidden
                      className="absolute size-3 rounded-full border-2 border-amber-400 [animation:held-alert-wave_1.4s_ease-out_infinite]"
                    />
                    <span
                      aria-hidden
                      className="relative size-2.5 rounded-full bg-amber-400"
                    />
                  </span>
                )}
              </button>
            );
          },
        )}
        <PosHeaderNavMenu />
        <PosHeaderUserPanel />
      </div>
    </header>
  );
}
