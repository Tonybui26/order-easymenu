"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, Delete } from "lucide-react";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import {
  STAFF_PIN_CODE_MAX_LENGTH,
  STAFF_PIN_CODE_MIN_LENGTH,
} from "@/lib/staff/staffRoles";
import { getAuthRedirectUrl } from "@/lib/constants/auth";

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

function LockScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { unlock } = useActiveOperator();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const storeName = session?.user?.storeName || "Order Manager";
  const callbackUrl = searchParams.get("callbackUrl");

  const pinDots = useMemo(
    () =>
      Array.from({ length: STAFF_PIN_CODE_MAX_LENGTH }, (_, index) => ({
        filled: index < pin.length,
      })),
    [pin],
  );

  async function submitPin(nextPin) {
    if (isSubmitting) return;
    if (
      nextPin.length < STAFF_PIN_CODE_MIN_LENGTH ||
      nextPin.length > STAFF_PIN_CODE_MAX_LENGTH
    ) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const result = await unlock(nextPin);
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
    setPin((current) => {
      if (current.length >= STAFF_PIN_CODE_MAX_LENGTH) return current;
      const next = `${current}${digit}`;
      if (next.length === STAFF_PIN_CODE_MAX_LENGTH) {
        queueMicrotask(() => submitPin(next));
      }
      return next;
    });
  }

  function handleDelete() {
    if (isSubmitting) return;
    setError("");
    setPin((current) => current.slice(0, -1));
  }

  return (
    <div className="flex min-h-[100vh] items-center justify-center bg-[#fff8f4] px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border-4 border-[#f8e3d8] bg-white p-8 shadow-lg">
        <div className="text-center">
          <p className="font-brand text-2xl text-gray-900">
            Easy<span className="text-brand_accent">Menu</span>
          </p>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Enter pin
          </h1>
          <p className="mt-1 text-sm text-gray-500">{storeName}</p>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {pinDots.map((dot, index) => (
            <span
              key={index}
              className={`size-3 rounded-full ${
                dot.filled ? "bg-brand_accent" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {error ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-gray-400">
            {isSubmitting ? "Checking…" : "4–6 digit pin"}
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3">
          {KEYPAD.map((key) => {
            if (key === "") {
              return <span key="empty" />;
            }
            if (key === "del") {
              return (
                <button
                  key="del"
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="flex h-14 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Delete"
                >
                  <Delete className="size-5" />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleDigit(key)}
                disabled={isSubmitting}
                className="h-14 rounded-xl text-xl font-semibold text-gray-900 transition hover:bg-[#fff4ee] active:bg-[#f8e3d8] disabled:opacity-50"
              >
                {key}
              </button>
            );
          })}
        </div>

        {pin.length >= STAFF_PIN_CODE_MIN_LENGTH &&
        pin.length < STAFF_PIN_CODE_MAX_LENGTH ? (
          <button
            type="button"
            onClick={() => submitPin(pin)}
            disabled={isSubmitting}
            className="mt-6 w-full rounded-xl bg-brand_accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand_accent/90 disabled:opacity-70"
          >
            Unlock
          </button>
        ) : null}
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
