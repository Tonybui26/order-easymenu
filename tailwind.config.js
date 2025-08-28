/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#D76228", // Add primary as a regular Tailwind color for mobile compatibility
        brand_accent: "#D76228",
        dark_background: "#212121", // #212121,3A3B38
        dark_text: "#ffffff",
      },
    },
  },
  plugins: [require("daisyui"), require("tailwindcss-animate")],
  daisyui: {
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["light"],
          primary: "#D76228",
          ".btn-primary": {
            color: "#fff",
          },
        },
      },
    ],
  },
};
