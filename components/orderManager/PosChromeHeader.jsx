"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePosNavigate } from "@/components/context/PosNavigateContext";
import {
  Folder,
  PanelBottomOpen,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { useMenuContext } from "@/components/context/MenuContext";
import { getPosHomePath } from "@/lib/pos/posConfig";
import PosHeaderNavMenu from "./PosHeaderNavMenu";
import PosHeaderUserPanel from "./PosHeaderUserPanel";
import Logo from "../../public/images/logo.svg";
import { reloadAppWithCatalogSync } from "@/lib/localDb/catalogForceSync";

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
  { id: "qr", label: "QR", Icon: QrCode, href: "/" },
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
    href: "/printer-management",
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
  const { menuConfig } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
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
        <span className="font-brand text-xl font-extrabold text-white xl:text-[1.4rem]">
          Easy<span className="text-brand_accent">Menu</span>
        </span>
      </button>

      <div className="flex items-center gap-3 sm:gap-6">
        {headerActions.map(({ id, label, Icon, href }) => {
          const isActive =
            href &&
            (pathname === href || (href !== "/" && pathname?.startsWith(href)));

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
                if (href) navigate(href);
              }}
              className={`flex size-10 items-center justify-center rounded-xl transition-colors active:bg-black/25 sm:size-11 ${
                isActive
                  ? "bg-brand_accent/25 text-brand_accent"
                  : "bg-brand_accent/10 text-white"
              }`}
            >
              <Icon size={24} strokeWidth={1.5} />
            </button>
          );
        })}
        <PosHeaderNavMenu />
        <PosHeaderUserPanel />
      </div>
    </header>
  );
}
