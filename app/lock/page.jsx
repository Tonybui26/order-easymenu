"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Delete } from "lucide-react";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import Image from "next/image";
import logoIcon from "../../public/images/logo.svg";
import {
  STAFF_PIN_CODE_MAX_LENGTH,
  STAFF_PIN_CODE_MIN_LENGTH,
} from "@/lib/staff/staffRoles";
import { getAuthRedirectUrl } from "@/lib/constants/auth";
import { useMenuContext } from "@/components/context/MenuContext";
import { resolvePosConfig } from "@/lib/pos/posConfig";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function LockScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { unlock } = useActiveOperator();
  const { menuConfig } = useMenuContext();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl");
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const restaurantModeEnabled = Boolean(
    resolvePosConfig(menuConfig).restaurantModeEnabled,
  );
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
      router.replace(
        getAuthRedirectUrl(callbackUrl, posEnabled, restaurantModeEnabled),
      );
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
    "flex aspect-square sm:aspect-[1.3] items-center justify-center rounded-lg bg-[#ffffff36] text-3xl sm:text-4xl text-white font-semibold text-gray-900 transition active:scale-95 disabled:opacity-50";

  return (
    <div className="bg-darken_primary flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-8 lg:px-20">
      <div className="mx-auto flex w-full max-w-[800px] flex-col items-center gap-8 md:flex-row md:justify-between md:gap-10">
        <div className="font-brand flex shrink-0 items-center justify-center gap-2">
          <Image
            src={logoIcon}
            alt="EasyMenu"
            className="size-10 sm:size-[57px] xl:size-16"
          />
          <h1 className="text-3xl font-bold text-white sm:text-[58px] xl:text-6xl">
            Easy<span className="text-brand_accent">Menu</span>
          </h1>
        </div>
        <div className="w-full max-w-[280px] rounded-3xl shadow-lg sm:max-w-xs">
          <div className="flex h-24 items-center justify-center rounded-lg bg-[#ffffff5c] text-2xl tracking-[0.35em] text-gray-900">
            {pin ? "•".repeat(pin.length) : null}
          </div>

          {error ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-3 sm:mt-6 sm:gap-4">
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
              <Delete className="size-6 sm:size-8" />
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
              className="flex aspect-square items-center justify-center rounded-lg bg-brand_accent text-white shadow-sm transition active:scale-95 sm:aspect-[1.3]"
              aria-label="Unlock"
            >
              <ArrowRight className="size-6 sm:size-8" strokeWidth={2.25} />
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
        // Match the PIN screen canvas — avoid a spinner flash during hydrate.
        <div className="min-h-[100dvh] bg-darken_primary" />
      }
    >
      <LockScreen />
    </Suspense>
  );
}
