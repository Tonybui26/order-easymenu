import { Heading } from "lucide-react";

export default function WithAndWithout() {
  const copyContent = {
    // heading: "Stop wasting time and resources when updating menu!",
    with: [
      "Instant updates at no additional cost",
      "Always accurate with real-time changes",
      "Reduces staff workload and improves service",
      "Easily scales with multilingual and visual options",
      "Engages customers with photos and details",
    ],
    without: [
      "Costly to reprint for updates",
      "Outdated menus confuse customers",
      "Staff repeats specials or unavailable dishes",
      "Hard to scale for diverse audiences",
      "Limited engagement; no visuals or interactivity",
    ],
  };
  return (
    <>
      <section className="main-wrapper max-w-[67rem] py-24 md:py-28">
        <h2 className="text-center text-3xl font-semibold md:text-[3.125rem] md:leading-[130%]">
          <span className="text-brand_accent">Boost revenue</span> and{" "}
          <span className="text-brand_accent">save cost</span> at the same time
        </h2>
        <div className="mt-20 flex flex-col gap-10 md:flex-row md:gap-14">
          <div className="relative w-full grow rounded-xl bg-[#EFEFEF] px-9 pb-11 pt-14 text-[#656565] md:w-1/2">
            <span className="absolute top-[-2.5rem] text-[3.75rem] saturate-0">
              😟
            </span>
            <p className="text-lg font-semibold md:text-xl">
              Traditional Printed Menu
            </p>
            <ul className="mt-5 space-y-3">
              {copyContent.without.map((item, index) => (
                <li key={index} className="flex items-center gap-2 md:text-lg">
                  <svg
                    width="16"
                    height="17"
                    viewBox="0 0 16 17"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="shrink-0"
                  >
                    <path
                      d="M9.87818 8.49883L15.606 2.78435C15.8568 2.53352 15.9977 2.19332 15.9977 1.8386C15.9977 1.48387 15.8568 1.14367 15.606 0.892842C15.3552 0.642013 15.015 0.501099 14.6602 0.501099C14.3055 0.501099 13.9653 0.642013 13.7145 0.892842L8 6.62064L2.28552 0.892842C2.03469 0.642013 1.6945 0.501099 1.33977 0.501099C0.985044 0.501099 0.644846 0.642013 0.394017 0.892842C0.143188 1.14367 0.00227327 1.48387 0.00227327 1.8386C0.00227327 2.19332 0.143188 2.53352 0.394017 2.78435L6.12182 8.49883L0.394017 14.2133C0.269166 14.3371 0.17007 14.4845 0.102444 14.6468C0.0348177 14.8091 0 14.9832 0 15.1591C0 15.3349 0.0348177 15.509 0.102444 15.6713C0.17007 15.8337 0.269166 15.981 0.394017 16.1048C0.517848 16.2297 0.665174 16.3288 0.827496 16.3964C0.989818 16.464 1.16392 16.4988 1.33977 16.4988C1.51562 16.4988 1.68972 16.464 1.85204 16.3964C2.01437 16.3288 2.16169 16.2297 2.28552 16.1048L8 10.377L13.7145 16.1048C13.8383 16.2297 13.9856 16.3288 14.148 16.3964C14.3103 16.464 14.4844 16.4988 14.6602 16.4988C14.8361 16.4988 15.0102 16.464 15.1725 16.3964C15.3348 16.3288 15.4822 16.2297 15.606 16.1048C15.7308 15.981 15.8299 15.8337 15.8976 15.6713C15.9652 15.509 16 15.3349 16 15.1591C16 14.9832 15.9652 14.8091 15.8976 14.6468C15.8299 14.4845 15.7308 14.3371 15.606 14.2133L9.87818 8.49883Z"
                      fill="#656565"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative w-full grow rounded-xl bg-[#FFEEE5] px-9 pb-11 pt-14 text-brand_accent md:w-1/2">
            <span className="absolute top-[-2.5rem] text-[3.75rem]">🤩</span>
            <p className="text-lg font-semibold md:text-xl">GoEasyMenu</p>
            <ul className="mt-5 space-y-3">
              {copyContent.with.map((item, index) => (
                <li key={index} className="flex items-center gap-2 md:text-lg">
                  <svg
                    width="22"
                    height="17"
                    viewBox="0 0 22 17"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="shrink-0"
                  >
                    <path
                      d="M7.28741 16.1858L0.314203 9.21256C-0.104734 8.79362 -0.104734 8.11436 0.314203 7.69538L1.83134 6.17821C2.25027 5.75923 2.92957 5.75923 3.34851 6.17821L8.04599 10.8756L18.1075 0.814203C18.5264 0.395266 19.2057 0.395266 19.6247 0.814203L21.1418 2.33138C21.5607 2.75031 21.5607 3.42957 21.1418 3.84855L8.80458 16.1858C8.3856 16.6047 7.70634 16.6047 7.28741 16.1858Z"
                      fill="#D76228"
                    />
                  </svg>

                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
