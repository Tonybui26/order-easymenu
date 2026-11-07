"use client";

import { BellRing, UserRound } from "lucide-react";
import SideDrawer from "./SideDrawer";

const OPTIONS = [
  { id: "customer", label: "CUSTOMER INFO", icon: UserRound },
  { id: "buzzer", label: "BUZZER", icon: BellRing },
];

/**
 * First step for a takeaway that can start with customer details or a buzzer.
 * Matches the brown POS keypad drawer so the two choices read clearly.
 */
export default function PosTakeawayChoiceDrawer({
  isOpen,
  onCancel,
  onChooseCustomer,
  onChooseBuzzer,
}) {
  function handleChoose(id) {
    if (id === "buzzer") onChooseBuzzer?.();
    else onChooseCustomer?.();
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
      contentKey="pos-takeaway-choice"
      ariaLabel="Takeaway"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <p className="mb-3 text-center text-base font-semibold text-white">
          Takeaway
        </p>

        <div className="flex flex-col gap-1.5">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleChoose(option.id)}
                className="flex min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-lg bg-[#ec7439] px-3 text-base font-bold tracking-wide text-white transition-colors hover:bg-[#e0662e] active:bg-[#d45c24]"
              >
                <Icon size={28} strokeWidth={1.75} />
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-auto min-h-[3.25rem] rounded-lg border border-white/40 text-sm font-bold tracking-wide text-white transition-colors hover:bg-white/10 active:bg-white/20"
        >
          Cancel
        </button>
      </div>
    </SideDrawer>
  );
}
