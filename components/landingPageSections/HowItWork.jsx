import Image from "next/image";
import ImageStep1 from "../../public/images/how-it-work-1.png";
import ImageStep2 from "../../public/images/how-it-work-2.png";
import ImageStep3 from "../../public/images/how-it-work-3.png";

export default function HowItWork() {
  const copyContent = {
    // title: "How it works?",
    // subTitle: "Boost revenue and save cost in 3 easy steps",
    steps: [
      {
        title: "Create free account",
        description: "Create a free account to start using GoEasyMenu",
        image: ImageStep1,
      },
      {
        title: "Setup your menu",
        description:
          "It's super easy to setup and customize the menu with your own identity",
        image: ImageStep2,
      },
      {
        title: "Print Qr code and display",
        description:
          "Once you happy with the result, just download and print the Qr code and display them in your restaurant",
        image: ImageStep3,
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
          <div className="flex flex-col gap-12 md:flex-row md:gap-16">
            {copyContent.steps.map((step, index) => (
              <div key={index} className="relative w-full text-center md:w-1/3">
                <div className="absolute -left-3 -top-3 flex size-10 items-center justify-center rounded-full bg-brand_accent text-[1.75rem] font-black text-white">
                  {index + 1}
                </div>
                {/* Image Holder */}
                <div className="aspect-square rounded-xl border-[5px] border-[#F3F3F3]">
                  <Image
                    src={step.image}
                    alt={step.title}
                    className="size-full object-cover"
                  />
                </div>
                <p className="mb-4 mt-3 text-xl font-medium md:text-2xl">
                  {step.title}
                </p>
                <p className="md:text-lg">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
