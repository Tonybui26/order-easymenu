"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Check, Delete, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/helper";
import InputText from "@/components/InputText";
import SideDrawer from "./SideDrawer";

const METHOD_OPTIONS = [
  { id: "customer", label: "CUSTOMER INFO", icon: UserRound },
  { id: "buzzer", label: "BUZZER", icon: BellRing },
];

const ORDER_TYPES = [
  { id: "dine-in", label: "DINE IN" },
  { id: "takeaway", label: "TAKEAWAY" },
];

const BUZZER_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "",
  "0",
  "backspace",
];

/**
 * @typedef {"methods" | "buzzer" | "customer" | "none"} StartPanel
 *
 * Takeaway / dine-in start drawer:
 * - methods: choose customer info or buzzer (both required)
 * - buzzer: order type + number pad in one step
 * - customer: order type + customer fields in one step
 * - none: order type only (tap type to continue)
 */
export default function PosTakeawayChoiceDrawer({
  isOpen,
  showOrderTypeChoice = false,
  startPanel = "methods",
  orderType = "dine-in",
  onOrderTypeChange,
  onCancel,
  onChooseCustomer,
  onChooseBuzzer,
  onConfirmOrderType,
  onConfirmBuzzer,
  onConfirmCustomer,
  requireName = false,
  requirePhone = false,
}) {
  const [digits, setDigits] = useState("");
  const [isMissingBuzzer, setIsMissingBuzzer] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setDigits("");
    setIsMissingBuzzer(false);
    setName("");
    setPhone("");
    setEmail("");
    setNameError("");
    setPhoneError("");
  }, [isOpen, startPanel]);

  function handleChooseMethod(id) {
    if (id === "buzzer") onChooseBuzzer?.();
    else onChooseCustomer?.();
  }

  function handleSelectOrderType(typeId) {
    onOrderTypeChange?.(typeId);
  }

  function handleFooterContinue() {
    if (startPanel === "buzzer") {
      handleBuzzerContinue();
      return;
    }
    if (startPanel === "customer") {
      handleCustomerContinue();
      return;
    }
    if (startPanel === "none") {
      onConfirmOrderType?.(orderType);
    }
  }

  const showContinue =
    startPanel === "buzzer" ||
    startPanel === "customer" ||
    startPanel === "none";

  function appendDigit(digit) {
    setIsMissingBuzzer(false);
    setDigits((prev) => (prev.length >= 6 ? prev : `${prev}${digit}`));
  }

  function handleBuzzerKey(key) {
    if (key === "backspace") {
      setIsMissingBuzzer(false);
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    appendDigit(key);
  }

  function handleBuzzerContinue() {
    const number = digits.trim();
    if (!number) {
      setIsMissingBuzzer(true);
      setShakeKey((key) => key + 1);
      return;
    }
    onConfirmBuzzer?.({ orderType, number });
  }

  function handleCustomerContinue(event) {
    event?.preventDefault?.();
    const nextName = name.trim();
    const nextPhone = phone.trim();
    const nextEmail = email.trim();
    let hasError = false;
    if (requireName && !nextName) {
      setNameError("Name is required");
      hasError = true;
    } else setNameError("");
    if (requirePhone && !nextPhone) {
      setPhoneError("Phone number is required");
      hasError = true;
    } else setPhoneError("");
    if (hasError) {
      nameInputRef.current?.focus?.({ preventScroll: true });
      return;
    }
    onConfirmCustomer?.({
      orderType,
      name: nextName,
      phone: nextPhone,
      email: nextEmail,
    });
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={undefined}
      showCloseButton={false}
      showHeader={false}
      side="left"
      widthClassName="w-[min(100%,22rem)]"
      panelClassName="bg-[#984B28]"
      bodyClassName=""
      contentKey={`pos-takeaway-choice-${startPanel}`}
      ariaLabel={showOrderTypeChoice ? "Order type" : "Takeaway"}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {showOrderTypeChoice ? (
          <div
            className="mb-4 grid grid-cols-2 gap-1.5"
            role="group"
            aria-label="Order type"
          >
            {ORDER_TYPES.map((type) => {
              const selected = orderType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => handleSelectOrderType(type.id)}
                  className={cn(
                    "relative flex min-h-11 items-center justify-center rounded-lg px-2 text-sm font-bold tracking-wide transition-colors",
                    selected
                      ? "bg-white text-[#984B28]"
                      : "bg-[#6f351c] text-white/80 hover:bg-[#7d3e22] hover:text-white",
                  )}
                >
                  {selected ? (
                    <Check
                      size={16}
                      strokeWidth={2.75}
                      className="absolute left-2.5"
                      aria-hidden
                    />
                  ) : null}
                  {type.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mb-3 text-center text-base font-semibold text-white">
            Takeaway
          </p>
        )}

        {startPanel === "methods" ? (
          <div className="flex flex-col gap-1.5">
            {METHOD_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleChooseMethod(option.id)}
                  className="flex min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-lg bg-[#ec7439] px-3 text-base font-bold tracking-wide text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
                >
                  <Icon size={28} strokeWidth={1.75} />
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {startPanel === "buzzer" ? (
          <>
            <motion.div
              key={shakeKey}
              initial={{ x: 0 }}
              animate={
                shakeKey > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }
              }
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className={`mb-3 flex min-h-[3.25rem] items-center justify-center rounded-lg px-4 text-3xl font-bold tabular-nums ${
                isMissingBuzzer
                  ? "bg-red-50 text-red-700 shadow-[0_0_0_2px_#ef4444]"
                  : "bg-white text-neutral-900"
              }`}
            >
              {digits ? (
                digits
              ) : (
                <span
                  className={
                    isMissingBuzzer
                      ? "text-lg font-semibold text-red-400"
                      : "text-lg font-semibold text-neutral-300"
                  }
                >
                  {isMissingBuzzer ? "Enter buzzer number" : "Buzzer number"}
                </span>
              )}
            </motion.div>

            <div className="mb-3 grid grid-cols-3 gap-1.5">
              {BUZZER_KEYS.map((key) => {
                if (!key) return <span key="spacer" />;
                if (key === "backspace") {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleBuzzerKey(key)}
                      className="flex h-16 items-center justify-center rounded-md bg-white text-neutral-800 shadow-sm transition-transform active:scale-95"
                      aria-label="Delete"
                    >
                      <Delete size={18} strokeWidth={2.25} />
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleBuzzerKey(key)}
                    className="flex h-16 items-center justify-center rounded-md bg-white text-xl font-semibold text-neutral-900 shadow-sm transition-transform active:scale-95"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {startPanel === "customer" ? (
          <form
            id="pos-takeaway-choice-customer-form"
            className="flex flex-col gap-3"
            onSubmit={handleCustomerContinue}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white">
                Name
                {requireName ? <span className="text-red-200"> *</span> : null}
              </span>
              <InputText
                ref={nameInputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                autoCapitalize="words"
                placeholder={requireName ? undefined : "Guest"}
                className={
                  nameError
                    ? "border-red-400 text-base focus:ring-red-200"
                    : "text-base"
                }
              />
              {nameError ? (
                <span className="mt-1 block text-xs font-medium text-red-200">
                  {nameError}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white">
                Phone number
                {requirePhone ? (
                  <span className="text-red-200"> *</span>
                ) : null}
              </span>
              <InputText
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                className={
                  phoneError
                    ? "border-red-400 text-base focus:ring-red-200"
                    : "text-base"
                }
              />
              {phoneError ? (
                <span className="mt-1 block text-xs font-medium text-red-200">
                  {phoneError}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white">
                Email
              </span>
              <InputText
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                className="text-base"
              />
            </label>
          </form>
        ) : null}

        <div
          className={cn(
            "mt-auto grid gap-1.5",
            showContinue ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.25rem] rounded-lg border border-white/40 text-sm font-bold tracking-wide text-white transition-colors hover:bg-white/10 active:bg-white/20"
          >
            Cancel
          </button>
          {showContinue ? (
            <button
              type={startPanel === "customer" ? "submit" : "button"}
              form={
                startPanel === "customer"
                  ? "pos-takeaway-choice-customer-form"
                  : undefined
              }
              onClick={
                startPanel === "customer" ? undefined : handleFooterContinue
              }
              className="min-h-[3.25rem] rounded-lg bg-white text-sm font-bold tracking-wide text-[#984B28] transition-colors hover:bg-neutral-100 active:bg-neutral-200"
            >
              Continue
            </button>
          ) : null}
        </div>
      </div>
    </SideDrawer>
  );
}
