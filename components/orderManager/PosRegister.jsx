"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/helper";
import {
  fetchPosRegisterSession,
  openPosRegisterSession,
} from "@/lib/api/fetchApi";
import { registerOperatorPayload } from "@/lib/pos/registerOperatorPayload";
import { useActiveOperator } from "@/components/context/ActiveOperatorContext";
import PosChromeHeader from "./PosChromeHeader";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";

const KEYPAD_ROWS = [
  ["1", "2", "3", "backspace"],
  ["4", "5", "6", "10"],
  ["7", "8", "9", "20"],
  ["0", "00", ".", "50"],
];

const QUICK_AMOUNTS = new Set(["10", "20", "50"]);

function formatFloatDisplay(value) {
  if (value === "" || value == null) return "$ 0.00";
  const normalized = String(value).replace(/^\$\s*/, "");
  if (normalized === "" || normalized === ".") return "$ 0.";
  return `$ ${normalized}`;
}

function formatRegisterDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatRegisterTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseFloatAmount(digits) {
  if (digits === "" || digits == null) return 0;
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * POS register open screen — opening float keypad.
 */
export default function PosRegister() {
  const router = useRouter();
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { activeOperator } = useActiveOperator();
  const [digits, setDigits] = useState("");
  const [now, setNow] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const intervalId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      setIsChecking(true);
      const result = await fetchPosRegisterSession();
      if (cancelled) return;
      if (result.success && result.session) {
        router.replace("/pos/register/session");
        return;
      }
      setIsChecking(false);
    }

    checkExistingSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function appendToken(token) {
    setDigits((prev) => {
      if (token === ".") {
        if (prev.includes(".")) return prev;
        return prev === "" ? "0." : `${prev}.`;
      }
      if (token === "00") {
        if (prev === "" || prev === "0") return "0";
        const [, decimals = ""] = prev.split(".");
        if (prev.includes(".") && decimals.length >= 2) return prev;
        if (prev.includes(".") && decimals.length === 1) return `${prev}0`;
        return `${prev}00`;
      }
      if (prev.includes(".")) {
        const [, decimals = ""] = prev.split(".");
        if (decimals.length >= 2) return prev;
      }
      if (prev === "0" && token !== ".") return token;
      const next = `${prev}${token}`;
      return next.length > 10 ? prev : next;
    });
  }

  function addQuickAmount(amount) {
    setDigits((prev) => {
      const current = prev === "" ? 0 : Number.parseFloat(prev);
      const base = Number.isFinite(current) ? current : 0;
      const next = Math.round((base + amount) * 100) / 100;
      return String(next);
    });
  }

  function handleKey(key) {
    if (isOpening) return;
    if (key === "backspace") {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (QUICK_AMOUNTS.has(key)) {
      addQuickAmount(Number(key));
      return;
    }
    appendToken(key);
  }

  function handleCancel() {
    router.push("/pos");
  }

  async function handleOpen() {
    if (isOpening) return;
    setIsOpening(true);
    try {
      const result = await openPosRegisterSession({
        openingFloat: parseFloatAmount(digits),
        operator: registerOperatorPayload(activeOperator),
      });
      if (!result.success) {
        if (result.status === 409) {
          toast.error(result.error || "Register is already open");
          router.replace("/pos");
          return;
        }
        toast.error(result.error || "Failed to open register");
        return;
      }
      router.push("/pos");
    } finally {
      setIsOpening(false);
    }
  }

  const hasEnteredAmount = digits !== "";
  const keyClassName =
    "flex aspect-[1.3] items-center justify-center rounded-lg bg-[#ffffff36] text-3xl font-semibold text-gray-900 transition active:scale-95 disabled:opacity-50 sm:text-4xl";

  if (isChecking) {
    return (
      <div className="bg-darken_primary flex h-[100dvh] w-full flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand_accent/30 border-t-brand_accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-darken_primary flex h-[100dvh] w-full flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-sm rounded-3xl bg-white/[0.06] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:p-6">
          <div className="mb-5 text-center">
            <div className="relative">
              {now ? (
                <p className="absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap text-sm text-white/70">
                  {formatRegisterDate(now)}
                  <span className="mx-2 text-white/30">·</span>
                  {formatRegisterTime(now)}
                </p>
              ) : null}
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                Open register
              </h1>
            </div>
            <p className="mt-1 text-sm text-white/55">Enter cash in register</p>
          </div>

          <div
            className={cn(
              "mb-5 flex h-16 items-center justify-center rounded-lg bg-[#ffffff5c] px-4 text-3xl font-semibold tabular-nums tracking-wide sm:text-4xl",
              hasEnteredAmount ? "text-gray-900" : "text-white/40",
            )}
          >
            {formatFloatDisplay(digits)}
          </div>

          <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            {KEYPAD_ROWS.flat().map((key) => {
              if (key === "backspace") {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKey(key)}
                    disabled={isOpening}
                    className={keyClassName}
                    aria-label="Delete"
                  >
                    <Delete className="size-7 sm:size-8" strokeWidth={2} />
                  </button>
                );
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKey(key)}
                  disabled={isOpening}
                  className={cn(
                    keyClassName,
                    QUICK_AMOUNTS.has(key) && "text-2xl sm:text-3xl",
                  )}
                >
                  {key}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isOpening}
              className="flex min-h-[3.5rem] items-center justify-center rounded-lg bg-[#ffffff36] text-base font-semibold text-white transition active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOpen}
              disabled={isOpening}
              className="flex min-h-[3.5rem] items-center justify-center rounded-lg bg-brand_accent text-base font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {isOpening ? "Opening…" : "Open"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
