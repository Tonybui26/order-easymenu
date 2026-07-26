"use client";

import PosChromeHeader from "./PosChromeHeader";
import PosHeldOrderCard from "./PosHeldOrderCard";

/** UI preview samples until Hold persistence is wired. */
const PREVIEW_HELD_ORDERS = [
  {
    _id: "preview-held-1",
    orderNumber: 1042,
    total: 48.5,
    orderType: "dine-in",
    table: "5",
    customerName: "Alex",
    createdAt: new Date(Date.now() - 1000 * 60 * 2 - 1000 * 18).toISOString(),
    heldAt: new Date(Date.now() - 1000 * 60 * 2 - 1000 * 18).toISOString(),
  },
  {
    _id: "preview-held-2",
    orderNumber: 1043,
    total: 22,
    orderType: "pick-up",
    customerName: "",
    createdAt: new Date(Date.now() - 1000 * 60 * 18 - 1000 * 40).toISOString(),
    heldAt: new Date(Date.now() - 1000 * 60 * 18 - 1000 * 40).toISOString(),
  },
  {
    _id: "preview-held-3",
    orderNumber: 1045,
    total: 76.25,
    orderType: "dine-in",
    table: "12",
    customerName: "Sam Nguyen",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    heldAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
];

/**
 * Held Orders screen — parked POS tickets.
 */
export default function PosHeldOrders() {
  const heldOrders = PREVIEW_HELD_ORDERS;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader />

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f0f0f0] pb-[env(safe-area-inset-bottom)]">
        {heldOrders.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <p className="text-lg font-semibold text-neutral-700">
                Held Orders
              </p>
              <p className="mt-2 text-sm text-neutral-400">
                No held orders yet
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">
                  Held Orders
                </h1>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {heldOrders.length} waiting to resume
                </p>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {heldOrders.map((order) => (
                <li key={order._id}>
                  <PosHeldOrderCard order={order} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
