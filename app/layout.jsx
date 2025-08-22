import { Nunito } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "@/lib/auth/nextAuthProvider";
import { GlobalAppContextProvider } from "@/components/context/GlobalContext";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata = {
  title: "Order Manager",
  description: "GoEasyMenu - Order Manager by GoEasyMenu",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} bg-neutral-900 antialiased`}>
        <NextAuthProvider>
          <GlobalAppContextProvider>{children}</GlobalAppContextProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
