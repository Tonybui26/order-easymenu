"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";

const PUBLIC_PATHS = ["/signin", "/signup", "/lock"];

export default function RequireActiveOperator({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const { hydrated, activeOperator } = useActiveOperator();

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isPublicPath || !hydrated || status !== "authenticated") return;
    if (!activeOperator) router.replace("/lock");
  }, [activeOperator, hydrated, isPublicPath, router, status]);

  if (isPublicPath) return children;

  if (status === "loading" || !hydrated) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  if (status === "authenticated" && !activeOperator) {
    return (
      <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
      </div>
    );
  }

  return children;
}
