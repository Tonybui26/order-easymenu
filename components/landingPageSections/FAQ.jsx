export default function FAQ() {
  const copyContent = {
    title: "FAQ",
    questions: [
      {
        question: "Why should I use GoEasyMenu for my restaurant?",
        answer:
          "GoEasyMenu saves you time and money by eliminating printed menus. With instant updates, interactive images, and full customization, you can keep your menu fresh and engaging effortlessly. Plus, we're continuously adding features like promotions, specials, chef's picks, and even order and payment options—helping you maximize the one thing every customer interacts with first: your menu.",
      },
      {
        question:
          "I’m not tech-savvy but want to try. Can I get help with the setup?",
        answer:
          "Absolutely! We've made it simple for you to get started. After creating a free account, just email us at support@goeasy.menu with your account details (email address), your menu in PDF format, and a profile image (like your logo). We will set up your menu for you. Once it's ready, you can log in to your account and make any changes you like!",
      },
      // {
      //   question: "Is GoEasyMenu free to use ?",
      //   answer:
      //     "Yes, GoEasyMenu is free to use! You can create and share your menu with customers at no cost. Optional paid plans are available for additional features.",
      // },
      {
        question: "I have created my menu. How do I share it with customers?",
        answer:
          "After creating your menu, you can download the QR code sheet. Print it and place it on your tables or around your establishment. Customers can scan the QR code with their phones to view your menu.",
      },
      {
        question: "Can I take order directly from the menu?",
        answer:
          "Currently, GoEasyMenu is in beta and only supports view mode. However, we’re actively working on adding order functionality. Stay tuned for updates!",
      },
      {
        question: "Is there any hidden cost?",
        answer:
          "No, there are no hidden costs. GoEasyMenu is free to use, with optional paid plans available for extra features.",
      },
      {
        question: "Do I need a website to use this?",
        answer:
          "No, you don’t need a website to use GoEasyMenu. You can create and share your menu directly with customers. If you already have a website, you can easily link your GoEasyMenu using the provided URL.",
      },
      {
        question: "Is there a limit to the menus or items I can create?",
        answer:
          "You can create one menu with unlimited items to customize as needed.",
      },
    ],
  };
  return (
    <>
      <section id="faq" className="FAQ-section pb-24 pt-10 md:pb-32 md:pt-20">
        <div className="main-wrapper max-w-[41.75rem]">
          <h2 className="mb-6 text-center text-2xl font-bold md:mb-8 md:text-[2.8rem] md:leading-[130%]">
            {copyContent.title}
          </h2>
          {/* Questions */}
          <div className="flex flex-col gap-3">
            {copyContent.questions.map((question, index) => (
              <div
                key={index}
                className="collapse collapse-arrow rounded-md bg-base-200"
              >
                <input type="radio" name="my-accordion-2" className="peer" />
                <div className="collapse-title text-lg font-medium peer-checked:text-brand_accent">
                  {question.question}
                </div>
                <div className="collapse-content">
                  <p className="md:text-lg">{question.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
