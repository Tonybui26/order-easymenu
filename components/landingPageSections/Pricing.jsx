import { Check } from "lucide-react";
import Link from "next/link";

export const plans = [
  // {
  //   title: "Monthly Plan",
  //   // desc: "Start with this plan",
  //   from: "$30",
  //   price: "$10",
  //   currency: "USD",
  //   period: "/ month",
  //   features: [
  //     "Unlimited Qr codes",
  //     "Unlimited Menu Items",
  //     "Unlimited Orders",
  //     "Unlimited Table",
  //     "Unlimited Staff",
  //   ],
  // },
  {
    title: "Lifetime Deal",
    desc: "Paid once and enjoy forever",
    from: "$110",
    features: [
      "Free menu setup to get you started!",
      "Unlimited menu Items",
      "Fully customizable",
      "Instant menu update",
      "Taking orders from table (coming soon)",
      "No hidden fees",
    ],
    link:
      process.env.NODE_ENV === "development"
        ? "https://buy.stripe.com/test_00g04226wgxQ2dicMN?prefilled_promo_code=LAUNCH55"
        : "https://buy.stripe.com/28o16n4J2b4ncEw3cc?prefilled_promo_code=LAUNCH55", // change for production
    priceId:
      process.env.NODE_ENV === "development"
        ? "price_1Qlszh4U1eG1DrfCiNpRX7Ua"
        : "price_1QlsfXGLc9oYiAs6DuMtcs6S", // change for production
    price: 55,
    currency: "USD",
    // duration: "/ one time",
  },
];

export default function Pricing() {
  const copyContent = {
    subTitle: "Simple Pricing",
    title: "Stop wasting money on printing menu",
    plans: plans,
  };
  return (
    <section id="pricing" className="bg-[#FFEEE5] py-20">
      <div className="main-wrapper max-w-[70rem]">
        {/* Section Heading */}
        <div className="mb-16 space-y-1 text-center">
          <span className="text-lg font-medium text-brand_accent md:text-xl">
            {copyContent.subTitle}
          </span>
          <h2 className="text-center text-3xl font-semibold md:text-[3.125rem] md:leading-[130%]">
            {copyContent.title}
          </h2>
        </div>
        <div className="py-3 text-center">
          <div className="inline-block animate-glow-fast rounded-full bg-[#de5a18] px-3 py-1 font-medium text-white shadow-xl ring-4 ring-yellow-500 ring-opacity-90">
            Launch discount -{" "}
            <span className="font-bold">$55 OFF limited time!</span>
          </div>
        </div>

        {/* Section Content */}
        <div className="flex flex-col justify-center gap-5 md:flex-row">
          {/* Pricing Item */}
          {copyContent.plans.map((item, index) => (
            <div
              key={index}
              className="flex w-full flex-col gap-7 rounded-2xl border-[0.25rem] border-[#ffe6da] bg-[#fff8f4] p-8 md:w-1/2 md:gap-8"
            >
              <div>
                <p className="text-lg font-bold md:text-xl">{item.title}</p>
                <p>{item.desc}</p>
              </div>
              <div className="flex items-end gap-2">
                <p className="relative text-lg font-semibold opacity-40 md:text-xl">
                  <span className="absolute inset-x-0 top-[48%] h-[1.5px] bg-base-content"></span>
                  <span className="text-base-content">{item.from}</span>
                </p>
                <p className="text-3xl font-bold text-brand_accent md:text-[2.5rem]">
                  ${item.price}{" "}
                  <span className="text-base opacity-40">USD</span>
                </p>
                <p>{item.period}</p>
              </div>
              <ul className="space-y-4 font-medium">
                {item.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="text-brand_accent" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a href={item.link} target="_blank" className="block">
                <button className="btn-primary btn btn-sm mx-auto w-full text-base font-semibold capitalize">
                  Get GoEasyMenu
                </button>
                <p className="mt-1 text-center text-sm font-medium text-brand_accent opacity-60">
                  Onetime payment. No subscription.
                </p>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
