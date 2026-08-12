import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { NextAuthProvider } from "@/lib/auth/nextAuthProvider";
import { GlobalAppContextProvider } from "@/components/context/GlobalAppContext";
import { getServerSession } from "next-auth";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { MenuContextProvider } from "@/components/context/MenuContext";
import { fetchGetMenuByOwnerEmail } from "@/lib/api/fetchApi";
import { Toaster } from "react-hot-toast";
import VersionBanner from "@/components/VersionBanner";
import PrintToastHost from "@/components/print/PrintToastHost";
import PosImmersiveHost from "@/components/orderManager/PosImmersiveHost";

const inter = Inter({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

const quicksand = localFont({
  src: "./fonts/Quicksand/Quicksand-VariableFont_wght.ttf",
  display: "swap",
  weight: "300 700",
  variable: "--font-quicksand",
});
export const metadata = {
  title: "Order Manager",
  description: "GoEasyMenu - Order Manager by GoEasyMenu",
};

/** Required for env(safe-area-inset-*) on notched iPhone / iPad (Capacitor). */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }) {
  const session = await getServerSession(NextAuthOptions);
  let user = null;
  let menuData = null;
  console.log(" check session", session);
  if (session && session.user) {
    console.log(" check session user", session.user);
    // get user data
    user = session.user;
    menuData = await fetchGetMenuByOwnerEmail(user.ownerEmail);
  }

  return (
    <html lang="en" className={quicksand.variable}>
      <body className={`${inter.className} min-h-[100vh] antialiased`}>
        <VersionBanner />
        <NextAuthProvider>
          <GlobalAppContextProvider userData={user}>
            <MenuContextProvider data={menuData}>
              {children}
              <PrintToastHost />
              <PosImmersiveHost />
            </MenuContextProvider>
          </GlobalAppContextProvider>
        </NextAuthProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
