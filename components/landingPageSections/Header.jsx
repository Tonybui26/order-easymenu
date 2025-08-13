import Image from "next/image";
import Logo from "../public/images/goeasymenu-logo.svg";
import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import ButtonOpenSettingPanel from "./ButtonOpenSettingPanel";
import TopNotificationBanner from "./TopNotificationBanner";
import ButtonCustomerPortal from "./ButtonCustomerPortal";

export default async function Header() {
  return (
    <>
      {/* <Link href={"mailto:support@goeasy.menu"} className="inline md:hidden">
        <TopNotificationBanner message="💡 Feedback & Support" />
      </Link> */}
      <header className="fixed left-0 top-0 z-30 w-full bg-white py-3 drop-shadow-custom md:top-0 md:py-5">
        <div className="flex items-center justify-between px-5">
          <Image
            src={Logo}
            alt="GoEasyMenu"
            className="w-[145px] lg:w-[155px]"
            priority
          />
          <div className="flex items-center gap-1">
            <div className="hidden gap-2 md:flex">
              {/* Link to email when click */}
              <Link href={"mailto:support@goeasy.menu"}>
                <div className="btn btn-link btn-sm">
                  <MessageCircleQuestion className="size-4" />
                  Feedback?
                </div>
              </Link>
            </div>
            <ButtonCustomerPortal />
          </div>
        </div>
      </header>
    </>
  );
}
