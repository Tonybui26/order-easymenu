import Image from "next/image";
import Logo from "../../public/images/logo.svg";
import SignInForm from "@/components/auth/SignInForm";
import { getServerUserSession } from "@/lib/auth/serverSession";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthRedirectUrl } from "@/lib/constants/auth";

export default async function SignInPage({ searchParams }) {
  const callbackUrl = searchParams?.callbackUrl;
  const redirectUrl = getAuthRedirectUrl(callbackUrl);
  const userSession = await getServerUserSession();
  if (userSession) {
    redirect(redirectUrl); // Redirect to callback URL if provided or default
  }

  return (
    <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto min-w-[350px] max-w-md translate-y-[-20%] rounded-2xl border-4 border-[#f8e3d8] bg-white p-8 shadow-lg sm:p-10 lg:min-w-[400px] xl:min-w-[450px]">
        <div className="text-center">
          <Link
            href="/"
            className="flex items-center justify-center gap-4 text-2xl font-bold text-primary"
          >
            <Image
              src={Logo}
              alt="GoEasyMenu"
              auto="true"
              className="w-[28px] lg:w-[36px]"
              priority
            />
            <span className="font-brand text-2xl text-gray-900 lg:text-3xl">
              Easy<span className="text-brand_accent">Menu</span>
            </span>
          </Link>
          <h2 className="mt-6 hidden text-2xl font-bold text-gray-900">
            Log in
          </h2>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
