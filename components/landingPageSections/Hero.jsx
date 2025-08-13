import Image from "next/image";
import qrcode_sample from "../../public/images/qrcode-sample.png";
import Link from "next/link";
export default function Hero() {
  const usp = [
    { text: "Stop wasting money on reprinting menus" },
    { text: "Update your menu instantly, hassle-free" },
    { text: "Engage customers with interactive, image-rich menus" },
    { text: "Fully customizable to match your brand identity" },
  ];
  return (
    <section className="pt-16 text-center md:pt-32">
      <div className="main-wrapper space-y-9 md:space-y-14">
        {/* Hero Headline */}
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-center text-[2.5rem] font-bold leading-[130%] md:text-[4rem]">
            <span className="text-brand_accent">Perfect digital menu</span> for
            your F&B business
          </h1>
          <p className="max-w-[50rem] text-center text-lg md:text-2xl md:leading-[150%]">
            Create digital menu in a few minutes and generate QR Code to offer
            customers secure and intuitive access
          </p>
        </div>
        {/* usp listing */}
        <ul className="mx-auto flex max-w-[90%] flex-col items-center gap-2 md:max-w-[33rem] md:items-start md:gap-3 md:text-xl">
          {usp.map((item, index) => (
            <li key={index} className="flex items-center gap-3">
              <svg
                width="22"
                height="17"
                viewBox="0 0 22 17"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 md:h-6 md:w-6"
              >
                <path
                  d="M7.28741 16.1858L0.314203 9.21256C-0.104734 8.79362 -0.104734 8.11436 0.314203 7.69538L1.83134 6.17821C2.25027 5.75923 2.92957 5.75923 3.34851 6.17821L8.04599 10.8756L18.1075 0.814203C18.5264 0.395266 19.2057 0.395266 19.6247 0.814203L21.1418 2.33138C21.5607 2.75031 21.5607 3.42957 21.1418 3.84855L8.80458 16.1858C8.3856 16.6047 7.70634 16.6047 7.28741 16.1858Z"
                  fill="#D76228"
                />
              </svg>
              <p className="text-left">{item.text}</p>
            </li>
          ))}
        </ul>
        {/* Qr Code Image */}
        <div className="relative mx-auto block w-[11.25rem]">
          <span className="absolute left-[-40px] top-[-20px] -rotate-12 font-semibold text-brand_accent">
            Scan here to try
            <svg
              width="29"
              height="42"
              viewBox="0 0 29 42"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M27.5261 38.166L14.5706 41.6374C14.4203 41.6777 14.2634 41.688 14.109 41.6676C13.9547 41.6473 13.8058 41.5968 13.671 41.5189C13.5362 41.4411 13.418 41.3375 13.3232 41.2139C13.2284 41.0904 13.1589 40.9494 13.1186 40.7991C13.0783 40.6487 13.068 40.4918 13.0884 40.3375C13.1087 40.1831 13.1592 40.0343 13.2371 39.8994C13.3149 39.7646 13.4185 39.6464 13.5421 39.5516C13.6656 39.4569 13.8066 39.3873 13.9569 39.347L24.1494 36.6158L10.199 28.5615C5.57391 25.8843 2.19967 21.4817 0.816519 16.3198C-0.566627 11.1578 0.154284 5.65795 2.82109 1.02684C2.97833 0.754506 3.2373 0.555785 3.54105 0.474395C3.8448 0.393006 4.16845 0.435614 4.44078 0.592847C4.71312 0.75008 4.91184 1.00906 4.99323 1.31281C5.07462 1.61656 5.03201 1.9402 4.87478 2.21254C2.52173 6.29881 1.88565 11.1516 3.10607 15.7063C4.32649 20.261 7.30375 24.1456 11.3847 26.5079L25.3351 34.5622L22.6042 24.3696C22.5228 24.0659 22.5654 23.7423 22.7226 23.47C22.8798 23.1977 23.1388 22.999 23.4425 22.9176C23.7462 22.8362 24.0698 22.8788 24.3421 23.036C24.6144 23.1932 24.8131 23.4522 24.8945 23.7559L28.3659 36.7113C28.3866 36.7881 28.3995 36.8668 28.4044 36.9462C28.4047 36.9509 28.4045 36.9555 28.4047 36.9601C28.4086 37.0329 28.4057 37.106 28.3962 37.1783C28.3955 37.1835 28.3942 37.1886 28.3935 37.1938C28.3832 37.2649 28.3664 37.3349 28.3433 37.4029C28.3421 37.4065 28.3404 37.41 28.3391 37.4137C28.2912 37.5525 28.2171 37.6807 28.1209 37.7916C28.1184 37.7946 28.1162 37.7978 28.1137 37.8007C28.0663 37.8547 28.0141 37.9042 27.9576 37.9487C27.9535 37.952 27.9498 37.9555 27.9456 37.9587C27.8878 38.0032 27.826 38.0422 27.761 38.0752C27.7568 38.0773 27.7529 38.0798 27.7487 38.0819C27.6775 38.1173 27.6029 38.1455 27.5261 38.166Z"
                fill="#D76228"
              />
            </svg>
          </span>
          <Image
            src={qrcode_sample}
            alt="Qr Code Sample"
            className="mx-auto mt-11 size-[11.25rem] rounded-xl border-[5px] border-base-200 shadow-lg"
            priority
          />
          <p>
            {" "}
            or{" "}
            <a
              href="https://goeasy.menu/m/toki-toki"
              target="_black"
              className="font-semibold text-brand_accent"
            >
              Click here
            </a>
          </p>
        </div>
        {/* CTA */}
        <Link href="/#pricing" className="block">
          <div className="btn-primary btn btn-sm mx-auto text-base font-semibold capitalize md:btn-lg md:text-lg">
            Build your digital menu today
          </div>
        </Link>
      </div>
    </section>
  );
}
