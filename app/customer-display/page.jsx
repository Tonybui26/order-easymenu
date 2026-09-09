"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import logoIcon from "../../public/images/logo.svg";

const IDLE_PAYLOAD = { mode: "idle", lines: [] };

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning ☀️";
  if (hour < 17) return "Good Afternoon ⛅️";
  return "Good Evening 🌙";
}

function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function CustomerDisplayPoweredByFooter() {
  return (
    <footer className="flex shrink-0 items-center justify-center border-t-4 border-[#331f11] bg-[#24160c] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="inline-flex items-center gap-2.5 text-left">
        <Image src={logoIcon} alt="" className="h-9 w-auto sm:h-10" priority />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white/60">
            Powered by
          </span>
          <span className="font-brand text-xl font-extrabold leading-[1.05] text-white sm:text-2xl sm:leading-[1.05]">
            Easy<span className="text-brand_accent">Menu</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

/**
 * Customer-facing rear display page (loaded in Presentation WebView).
 * Receives cart snapshots from the main POS via CustomEvent / global hook.
 */
export default function CustomerDisplayPage() {
  const [payload, setPayload] = useState(IDLE_PAYLOAD);
  const [greeting, setGreeting] = useState(getTimeGreeting);

  useEffect(() => {
    function apply(next) {
      if (!next || typeof next !== "object") {
        setPayload(IDLE_PAYLOAD);
        return;
      }
      setPayload(next);
    }

    function onCartEvent(event) {
      apply(event?.detail);
    }

    window.addEventListener("customer-display-cart", onCartEvent);
    window.__onCustomerDisplayCart = apply;

    return () => {
      window.removeEventListener("customer-display-cart", onCartEvent);
      if (window.__onCustomerDisplayCart === apply) {
        delete window.__onCustomerDisplayCart;
      }
    };
  }, []);

  useEffect(() => {
    function refreshGreeting() {
      setGreeting(getTimeGreeting());
    }

    refreshGreeting();
    const intervalId = window.setInterval(refreshGreeting, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const isCart =
    payload?.mode === "cart" &&
    Array.isArray(payload.lines) &&
    payload.lines.length > 0;
  const lines = isCart ? payload.lines : [];
  const discountAmount = Number(payload?.discountAmount || 0);
  const total = Number(payload?.total ?? payload?.subtotal ?? 0);

  if (!isCart) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-[#301C0F] text-center text-white">
        <div className="flex flex-1 items-center justify-center px-8">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            {greeting}
          </h1>
        </div>
        <CustomerDisplayPoweredByFooter />
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white text-neutral-900">
      <header className="border-b border-neutral-200 px-6 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your order</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ul className="space-y-4">
          {lines.map((line) => (
            <li
              key={line.id || `${line.name}-${line.quantity}`}
              className="flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-lg font-medium leading-snug">
                  <span className="tabular-nums text-neutral-500">
                    {line.quantity}×
                  </span>{" "}
                  {line.name}
                </p>
                {Array.isArray(line.options) && line.options.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 pl-1 text-sm text-neutral-500">
                    {line.options.map((option) => (
                      <li key={`${line.id}-${option}`}>{option}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="shrink-0 text-lg font-medium tabular-nums">
                {formatMoney(line.lineTotal)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-6 py-5">
        {discountAmount > 0 ? (
          <div className="mb-2 flex items-center justify-between text-base text-neutral-500">
            <span>Discount</span>
            <span className="tabular-nums">−{formatMoney(discountAmount)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-xl font-semibold">Total</span>
          <span className="text-3xl font-bold tabular-nums">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      <CustomerDisplayPoweredByFooter />
    </main>
  );
}
