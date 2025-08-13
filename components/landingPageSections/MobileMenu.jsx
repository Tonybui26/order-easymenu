"use client";
import Image from "next/image";
import Logo from "../../public/images/goeasymenu-logo.svg";
import { X } from "lucide-react";
import MenuItems from "../menu/MenuItems";
import CTA from "../menu/CTA";
import { useGlobalAppContext } from "../context/GlobalAppContext";

export default function MobileMenu() {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useGlobalAppContext();
  const closeMenu = () => {
    setIsMobileMenuOpen(false);
  };
  return (
    <div
      role="menu"
      className={`main-wrapper fixed inset-y-0 z-10 ${isMobileMenuOpen ? "block" : "hidden"} w-full bg-white md:hidden`}
    >
      {/* Menu Header */}
      <div className="flex items-center justify-between py-3">
        <Image
          src={Logo}
          alt="GoEasyMenu"
          className="w-[145px] lg:w-[155px]"
          priority
        />
        {/* Close menu */}
        <button onClick={closeMenu} className="btn-closeMenu">
          <X className="size-7 text-brand_accent" />
        </button>
      </div>
      {/* Menu Content */}
      <ul className="flex flex-col gap-5 pt-7 text-lg font-medium">
        <MenuItems />
      </ul>
      {/* CTA */}
      <div className="mt-10">
        <CTA />
      </div>
    </div>
  );
}
