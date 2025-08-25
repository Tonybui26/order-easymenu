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
    <div className="min-h-[100vh] bg-[#fff8f4] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-xl bg-white p-8 shadow-lg sm:p-10">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-primary">
            <Image
              src={Logo}
              alt="GoEasyMenu"
              auto="true"
              className="mx-auto w-[28px] lg:w-[30px]"
              priority
            />
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Sign in</h2>
        </div>
        <div className="mt-8">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
