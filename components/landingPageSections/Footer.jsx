import Image from "next/image";
import Logo from "../../public/images/goeasymenu-logo.svg";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t-2 border-[#FFECE2] bg-[#FFF3ED]">
      <div className="main-wrapper">
        <div className="flex flex-col items-center justify-between gap-10 py-24 md:flex-row md:items-start md:gap-28">
          <div className="flex max-w-[17rem] flex-col items-center gap-5 md:items-start">
            <div className="text-center md:text-left">
              <Image
                src={Logo}
                alt="GoEasyMenu"
                className="mb-3 inline-block w-40"
              />
              <p>
                Create your perfect digital menu in minutes and grow your
                business
              </p>
            </div>
            <p className="text-[#676767]">
              Copyright ©2025 - All rights reserved
            </p>
            <p className="text-[#676767]">
              Made with ☕️ by{" "}
              <span className="font-semibold text-brand_accent">Tony</span>
            </p>
          </div>
          <div className="text-center md:text-left">
            <h3 className="mb-3 font-bold uppercase text-brand_accent">
              links
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/signin">Login</Link>
              </li>
              <li>
                <a href="#">Faq</a>
              </li>
              <li>
                <a href="mailto:support@goeasy.menu">Support</a>
              </li>
            </ul>
          </div>
          <div className="text-center md:text-left">
            <h3 className="mb-3 font-bold uppercase text-brand_accent">
              Legal
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/terms">Term of services</Link>
              </li>
              <li>
                <Link href="/privacy-policy">Privacy policy</Link>
              </li>
            </ul>
          </div>
          <div className="text-center md:text-left">
            <h3 className="mb-3 font-bold uppercase text-brand_accent">more</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <a href="https://mecook.app/" target="_blank">
                  Mecook
                </a>
              </li>
              <li>
                <a href="https://www.snaplist.io/" target="_blank">
                  Snaplist
                </a>
              </li>
              {/* <li>
                <a href="https://sitedrift.com/" target="_blank">
                  Sitedrift
                </a>
              </li> */}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
