"use client";

import { BellRing, Check, UserRound } from "lucide-react";
import { cn } from "@/lib/helper";
import SideDrawer from "./SideDrawer";

const OPTIONS = [
  { id: "customer", label: "CUSTOMER INFO", icon: UserRound },
  { id: "buzzer", label: "BUZZER", icon: BellRing },
];

const ORDER_TYPES = [
  { id: "dine-in", label: "DINE IN" },
  { id: "takeaway", label: "TAKEAWAY" },
];

/**
 * First step for a takeaway that can start with customer details or a buzzer.
 * When dine-in buzzer is on, the title is a Dine in / Takeaway selection.
 * Matches the brown POS keypad drawer so the two choices read clearly.
 */
export default function PosTakeawayChoiceDrawer({
  isOpen,
  showOrderTypeChoice = false,
  orderType = "dine-in",
  onOrderTypeChange,
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
                  onClick={() => onOrderTypeChange?.(type.id)}
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
