import Image from "next/image";
import Logo from "../../public/images/logo.svg";
import SignInForm from "@/components/auth/SignInForm";
import ButtonContinueWithGoogle from "@/components/auth/ButtonContinueWithGoogle";
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
    <div className="min-h-[100vh] bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-xl bg-white p-8 shadow-lg sm:p-10">
        <div className="text-center">
          <Link href="/" className="text-primary text-2xl font-bold">
            <Image
              src={Logo}
              alt="GoEasyMenu"
              auto="true"
              className="mx-auto w-[28px] lg:w-[30px]"
              priority
            />
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <div className="mt-8">
          <div className="mt-6">
            <ButtonContinueWithGoogle callbackUrl={redirectUrl} />
          </div>
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">
                Or sign in with email
              </span>
            </div>
          </div>
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
