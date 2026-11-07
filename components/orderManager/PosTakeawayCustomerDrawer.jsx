"use client";

import { useEffect, useRef, useState } from "react";
import InputText from "@/components/InputText";
import SideDrawer from "./SideDrawer";

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  error = "",
  autoComplete,
  autoCapitalize,
  enterKeyHint,
  inputMode,
  inputRef,
  onKeyDown,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <InputText
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        enterKeyHint={enterKeyHint}
        inputMode={inputMode}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={
          error ? "border-red-400 text-base focus:ring-red-200" : "text-base"
        }
      />
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function requirementSubtitle(requireName, requirePhone) {
  if (requireName && requirePhone) return "Name and phone number are required";
  if (requireName) return "Name is required";
  if (requirePhone) return "Phone number is required";
  return undefined;
}

function firstRequiredField(requireName, requirePhone, name, phone) {
  if (requireName && !String(name || "").trim()) return "name";
  if (requirePhone && !String(phone || "").trim()) return "phone";
  if (requireName) return "name";
  if (requirePhone) return "phone";
  return null;
}

function placeCaret(input) {
  const length = input.value.length;
  try {
    input.setSelectionRange(length, length);
  } catch {
    // Some input types reject a selection range.
  }
}

function focusInput(input) {
  if (!input || document.activeElement === input) return;
  input.focus({ preventScroll: true });
  placeCaret(input);
}

/**
 * Customer details for the current POS check.
 * Takeaway can require a name, a phone number, or both, based on POS settings.
 */
export default function PosTakeawayCustomerDrawer({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  requireName = false,
  requirePhone = false,
  initialName = "",
  initialPhone = "",
  initialEmail = "",
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const hasRequiredField = requireName || requirePhone;

  function focusRequiredField(nameValue = name, phoneValue = phone) {
    const field = firstRequiredField(
      requireName,
      requirePhone,
      nameValue,
      phoneValue,
    );
    if (!field) return;
    const input =
      field === "phone" ? phoneInputRef.current : nameInputRef.current;
    focusInput(input);
  }

  useEffect(() => {
    if (!isOpen) return;
    setName(String(initialName || ""));
    setPhone(String(initialPhone || ""));
    setEmail(String(initialEmail || ""));
    setNameError("");
    setPhoneError("");
  }, [isOpen, initialName, initialPhone, initialEmail]);

  function handleNameKeyDown(event) {
    if (event.key !== "Enter" || !requirePhone) return;
    event.preventDefault();
    focusInput(phoneInputRef.current);
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    const nextName = name.trim();
    const nextPhone = phone.trim();
    const nextEmail = email.trim();

    let hasError = false;
    if (requireName && !nextName) {
      setNameError("Name is required");
      hasError = true;
    } else {
      setNameError("");
    }
    if (requirePhone && !nextPhone) {
      setPhoneError("Phone number is required");
      hasError = true;
    } else {
      setPhoneError("");
    }
    if (hasError) {
      focusRequiredField(nextName, nextPhone);
      return;
    }

    onConfirm?.({
      name: nextName,
      phone: nextPhone,
      email: nextEmail,
    });
  }

  function handleCancel() {
    if (hasRequiredField) {
      onCancel?.();
      return;
    }
    onClose?.();
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={hasRequiredField ? undefined : onClose}
      showCloseButton={!hasRequiredField}
      onEntered={
        hasRequiredField
          ? () => focusRequiredField(initialName, initialPhone)
          : undefined
      }
      title={hasRequiredField ? "Takeaway customer" : "Customer info"}
      subtitle={requirementSubtitle(requireName, requirePhone)}
      side="left"
      widthClassName="w-[min(100%,24rem)]"
      contentKey="pos-takeaway-customer"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-[48px] flex-1 rounded-lg border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pos-takeaway-customer-form"
            className="min-h-[48px] flex-1 rounded-lg bg-[#984B28] text-sm font-semibold text-white transition-colors hover:bg-[#7f3f22]"
          >
            {hasRequiredField ? "Continue" : "Save"}
          </button>
        </div>
      }
    >
      <form
        id="pos-takeaway-customer-form"
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <Field
          id="takeaway-customer-name"
          label="Name"
          value={name}
          onChange={setName}
          required={requireName}
          error={nameError}
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint={requirePhone ? "next" : "done"}
          inputRef={nameInputRef}
          onKeyDown={handleNameKeyDown}
          placeholder={requireName ? undefined : "Guest"}
        />
        <Field
          id="takeaway-customer-phone"
          label="Phone number"
          value={phone}
          onChange={setPhone}
          type="tel"
          required={requirePhone}
          error={phoneError}
          autoComplete="tel"
          enterKeyHint="done"
          inputMode="tel"
          inputRef={phoneInputRef}
        />
        <Field
          id="takeaway-customer-email"
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          inputMode="email"
        />
      </form>
    </SideDrawer>
  );
}
