"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { AUTH_CONFIG } from "@/lib/constants/auth";

export default function ButtonContinueWithGoogle({ callbackUrl }) {
  const searchParams = useSearchParams();
  // Use the passed callbackUrl or get it from URL params as fallback
  const finalCallbackUrl =
    callbackUrl ||
    searchParams.get("callbackUrl") ||
    AUTH_CONFIG.DEFAULT_REDIRECT_URL;
  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: finalCallbackUrl });
  };
  return (
    <>
      <button
        onClick={handleGoogleSignIn}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border-2 border-slate-300 bg-slate-100 p-7 text-base font-medium text-neutral-800 outline-none transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
      >
        <img
          src="https://www.svgrepo.com/show/475656/google-color.svg"
          alt="Google"
          className="size-[25px]"
        />
        Continue with Google
      </button>
    </>
  );
}
