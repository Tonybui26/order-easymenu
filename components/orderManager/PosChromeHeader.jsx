"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Folder, Headset, Printer, QrCode } from "lucide-react";
import { useMenuContext } from "@/components/context/MenuContext";
import PosHeaderNavMenu from "./PosHeaderNavMenu";
import Logo from "../../public/images/logo.svg";

const POS_HEADER_ACTIONS = [
  { id: "support", label: "Support", Icon: Headset },
  {
    id: "held",
    label: "Held Orders",
    Icon: Folder,
    href: "/pos/held",
    requiresPos: true,
  },
  { id: "qr", label: "QR", Icon: QrCode, href: "/" },
  {
    id: "print",
    label: "Printer",
    Icon: Printer,
    href: "/printer-management",
  },
];

const POS_HOME_PATH = "/pos";

/**
 * Shared POS chrome header: EasyMenu logo, shortcut icons, feature switcher.
 * @param {{ onLogoClick?: () => void }} props
 */
export default function PosChromeHeader({ onLogoClick }) {
  const router = useRouter();
  const pathname = usePathname();
  const { menuConfig } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);

  const headerActions = POS_HEADER_ACTIONS.filter(
    (action) => !action.requiresPos || posEnabled,
  );

  function handleLogoClick() {
    onLogoClick?.();
    const homePath = posEnabled ? POS_HOME_PATH : "/";
    if (pathname !== homePath) {
      router.push(homePath);
    }
  }

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 bg-[#301C0F] px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={handleLogoClick}
        aria-label="Point of sale"
        className="flex items-center gap-1.5 rounded-lg transition-colors active:bg-white/10"
      >
        <Image
          src={Logo}
          alt=""
          aria-hidden
          className="size-8 xl:size-9"
          priority
        />
        <span className="text-base font-bold text-white xl:text-lg">
          Easy<span className="text-brand_accent">Menu</span>
        </span>
      </button>

      <div className="flex items-center gap-3 sm:gap-6">
        {headerActions.map(({ id, label, Icon, href }) => {
          const isActive =
            href &&
            (pathname === href ||
              (href !== "/" && pathname?.startsWith(href)));

          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (href) router.push(href);
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
      </div>
    </header>
  );
}
