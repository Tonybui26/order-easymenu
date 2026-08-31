"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { sendOrderReceiptEmail } from "@/lib/api/fetchApi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Staff modal to send an order receipt email (same flow as Live Order Terminal).
 */
export default function EmailReceiptModal({
  isOpen,
  onClose,
  orderId,
  defaultEmail = "",
  onSent,
}) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(String(defaultEmail || "").trim());
    }
  }, [isOpen, defaultEmail]);

  function handleClose() {
    if (isSending) return;
    onClose?.();
  }

  async function handleSend() {
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!orderId) {
      toast.error("Could not load order for receipt.");
      return;
    }

    setIsSending(true);
    try {
      await sendOrderReceiptEmail(orderId, trimmedEmail);
      toast.success("Receipt sent.");
      onSent?.();
      onClose?.();
    } catch (error) {
      toast.error(error?.message || "Could not send receipt. Try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <dialog className={`modal ${isOpen ? "modal-open" : ""}`} aria-labelledby="receipt-email-title">
      <div className="modal-box max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="receipt-email-title" className="text-lg font-bold text-gray-800">
            Email receipt
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSending}
            className="btn btn-circle btn-ghost btn-sm disabled:pointer-events-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input input-md mt-2 w-full rounded-lg border-2 bg-gray-200 text-base placeholder:text-neutral-500 focus:border-brand_accent/70 focus:outline-none"
            placeholder="customer@example.com"
            autoComplete="email"
            disabled={isSending}
          />
        </label>

        <div className="modal-action">
          <button
            type="button"
            disabled={isSending}
            onClick={handleSend}
            className="btn-primary btn btn-sm h-auto w-auto px-5 py-3"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={handleClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
