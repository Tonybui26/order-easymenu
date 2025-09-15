import { Inter } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "@/lib/auth/nextAuthProvider";
import { GlobalAppContextProvider } from "@/components/context/GlobalAppContext";
import { getServerSession } from "next-auth";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { MenuContextProvider } from "@/components/context/MenuContext";
import { fetchGetMenuByOwnerEmail } from "@/lib/api/fetchApi";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Order Manager",
  description: "GoEasyMenu - Order Manager by GoEasyMenu",
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
    <html lang="en">
      <body className={`${inter.className} min-h-[100vh] antialiased`}>
        <NextAuthProvider>
          <GlobalAppContextProvider userData={user}>
            <MenuContextProvider data={menuData}>
              {children}
            </MenuContextProvider>
          </GlobalAppContextProvider>
        </NextAuthProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
