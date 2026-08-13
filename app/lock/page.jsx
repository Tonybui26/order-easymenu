"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Delete } from "lucide-react";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import Image from "next/image";
import logoIcon from "../../../easymenu/public/images/goeasymenu-logo-icon.svg";
import {
  STAFF_PIN_CODE_MAX_LENGTH,
  STAFF_PIN_CODE_MIN_LENGTH,
} from "@/lib/staff/staffRoles";
import { getAuthRedirectUrl } from "@/lib/constants/auth";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function LockScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { unlock } = useActiveOperator();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl");
  const canSubmit =
    pin.length >= STAFF_PIN_CODE_MIN_LENGTH &&
    pin.length <= STAFF_PIN_CODE_MAX_LENGTH;

  async function submitPin() {
    if (isSubmitting || !canSubmit) return;

    setIsSubmitting(true);
    setError("");
    try {
      const result = await unlock(pin);
      if (!result.ok) {
        setError(
          result.status === 429
            ? "Too many attempts. Try again shortly."
            : "Incorrect pin",
        );
        setPin("");
        return;
      }
      router.replace(getAuthRedirectUrl(callbackUrl));
    } catch {
      setError("Unable to verify pin");
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDigit(digit) {
    if (isSubmitting) return;
    setError("");
    setPin((current) =>
      current.length >= STAFF_PIN_CODE_MAX_LENGTH
        ? current
        : `${current}${digit}`,
    );
  }

  function handleDelete() {
    if (isSubmitting) return;
    setError("");
    setPin((current) => current.slice(0, -1));
  }

  const keyClassName =
    "flex aspect-[1.3] items-center justify-center rounded-lg bg-[#ffffff36] text-4xl text-white font-semibold text-gray-900 transition active:scale-95 disabled:opacity-50";

  return (
    <div className="bg-darken_primary flex min-h-[100vh] items-center justify-between gap-10 px-4 py-12 sm:px-20">
      <div className="mx-auto flex w-full max-w-[800px] justify-between gap-10">
        <div className="font-brand flex items-center justify-center gap-2">
          <Image
            src={logoIcon}
            alt="EasyMenu"
            className="size-[57px] xl:size-16"
          />
          <h1 className="text-[58px] font-bold text-white xl:text-6xl">
            Easy<span className="text-brand_accent">Menu</span>
          </h1>
        </div>
        <div className="w-full max-w-xs rounded-3xl shadow-lg">
          <div className="flex h-24 items-center justify-center rounded-lg bg-[#ffffff5c] text-2xl tracking-[0.35em] text-gray-900">
            {pin ? "•".repeat(pin.length) : null}
          </div>

          {error ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-3 gap-4">
            {DIGITS.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                disabled={isSubmitting}
                className={keyClassName}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className={keyClassName}
              aria-label="Delete"
            >
              <Delete className="size-8" />
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              disabled={isSubmitting}
              className={keyClassName}
            >
              0
            </button>
            <button
              type="button"
              onClick={submitPin}
              disabled={isSubmitting || !canSubmit}
              className="flex aspect-[1.3] items-center justify-center rounded-lg bg-brand_accent text-white shadow-sm transition active:scale-95"
              aria-label="Unlock"
            >
              <ArrowRight className="size-8" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LockPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
        </div>
      }
    >
      <LockScreen />
    </Suspense>
  );
}
