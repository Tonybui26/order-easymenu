"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { sendRefundConfirmationEmail } from "@/lib/api/fetchApi";

function isValidEmail(email) {
  const s = String(email || "").trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function SendRefundConfirmationModal({
  isOpen,
  onClose,
  order,
}) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      setEmail(String(order.customerEmail || "").trim());
    }
  }, [isOpen, order]);

  if (!order) return null;

  const refundAmount = order.refund?.amount;
  const isPartial = order.refund?.refundType === "partial";
  const orderIdShort = order._id?.slice(-6).toUpperCase();

  const handleClose = () => {
    if (!isSending) {
      setEmail("");
      onClose();
    }
  };

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setIsSending(true);
    try {
      await sendRefundConfirmationEmail(order._id, trimmed);
      toast.success("Refund confirmation sent.");
      handleClose();
    } catch (error) {
      toast.error(error?.message || "Could not send refund confirmation.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <dialog
      className={`modal ${isOpen ? "modal-open" : ""}`}
      aria-labelledby="refund-confirmation-email-title"
    >
      <div className="modal-box max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="refund-confirmation-email-title"
            className="text-lg font-bold text-gray-800"
          >
            Send refund confirmation — #{orderIdShort}
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

        {refundAmount != null && (
          <div className="mb-4 rounded-lg bg-gray-100 p-4 text-sm">
            <p className="font-medium text-gray-900">
              {isPartial ? "Partial refund" : "Full refund"}: $
              {Number(refundAmount).toFixed(2)}
            </p>
            {isPartial && order.total != null && (
              <p className="mt-1 text-gray-600">
                Original order total: ${Number(order.total).toFixed(2)}
              </p>
            )}
          </div>
        )}

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input input-md mt-2 w-full rounded-lg border-2 bg-gray-200 text-base placeholder:text-neutral-500 focus:border-brand_accent/70 focus:outline-none"
            placeholder="customer@example.com"
            autoComplete="email"
            disabled={isSending}
          />
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Sends refund amount and bank tracking details when available.
        </p>

        <div className="modal-action">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSending}
            className="btn btn-outline btn-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSending || !email.trim()}
            onClick={handleSend}
            className="btn-primary btn btn-sm h-auto w-auto px-5 py-3"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
      <form
        method="dialog"
        className="modal-backdrop"
        onClick={handleClose}
      >
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
