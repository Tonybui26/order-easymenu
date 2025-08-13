import { MoveRight } from "lucide-react";
import Image from "next/image";

export default function HowItWork2() {
  const copyContent = {
    // title: "How it works?",
    // subTitle: "Boost revenue and save cost in 3 easy steps",
    steps: [
      {
        title: "Create an account",
        description: "Create a free account to start using GoEasyMenu",
        // image: ImageStep1,
      },
      {
        title: "Setup your menu",
        description:
          "It's super easy to setup and customize the menu with your own identity",
        // image: ImageStep2,
      },
      {
        title: "Print Qr code and display",
        description:
          "Once you happy with the result, just download and print the Qr code and display them in your restaurant",
        // image: ImageStep3,
      },
    ],
  };
  return (
    <>
      <section className="section-how-it-work pb-28 pt-1 md:pt-10">
        <div className="main-wrapper max-w-[70rem]">
          {/* Section Heading */}
          <div className="mb-16 space-y-1 text-center">
            <span className="text-lg font-medium text-brand_accent md:text-xl">
              How it works?
            </span>
            <h2 className="text-center text-3xl font-semibold md:text-[3.125rem] md:leading-[130%]">
              Get started in just{" "}
              <span className="text-brand_accent">3 easy steps</span>{" "}
            </h2>
          </div>
          {/* Steps */}
          <div className="flex flex-col gap-7 md:flex-row md:gap-16">
            {copyContent.steps.flatMap((step, index) => {
              const isLast = index === copyContent.steps.length - 1;
              const elements = [
                <div
                  key={`step-${index}`}
                  className="relative w-full text-center md:w-1/3"
                >
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-brand_accent text-[1.5rem] font-black text-white">
                    {index + 1}
                  </div>
                  <p className="mb-4 mt-3 text-xl font-medium md:text-2xl">
                    {step.title}
                  </p>
                  <p className="md:text-lg">{step.description}</p>
                </div>,
              ];

              if (!isLast) {
                elements.push(
                  <div
                    key={`arrow-${index}`}
                    className="grid place-items-center text-brand_accent"
                  >
                    <MoveRight className="rotate-90 md:rotate-0" />
                  </div>,
                );
              }

              return elements;
            })}
          </div>
        </div>
      </section>
    </>
  );
}
