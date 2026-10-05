"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/helper";
import PosActionButton from "./PosActionButton";
import SideDrawer from "./SideDrawer";

function assignButtonLabel(tables) {
  if (tables.length === 0) return "Select tables";
  const labels = tables.map((table) => table.label).join(", ");
  return tables.length === 1
    ? `Assign table ${labels}`
    : `Assign tables ${labels}`;
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-2.5 last:border-b-0">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-neutral-900">
        {value || "—"}
      </dd>
    </div>
  );
}

export default function BookingDetailsDrawer({
  booking,
  tables,
  onClose,
  onAssign,
}) {
  const [selectedTableIds, setSelectedTableIds] = useState([]);
  const selectedTables = tables.filter((table) =>
    selectedTableIds.includes(table.id),
  );
  const selectedSeats = selectedTables.reduce(
    (total, table) => total + table.seats,
    0,
  );

  useEffect(() => {
    setSelectedTableIds([]);
  }, [booking?.id]);

  function toggleTable(tableId) {
    setSelectedTableIds((current) =>
      current.includes(tableId)
        ? current.filter((id) => id !== tableId)
        : [...current, tableId],
    );
  }

  return (
    <SideDrawer
      isOpen={Boolean(booking)}
      onClose={onClose}
      title={booking?.name || "Booking"}
      subtitle={
        booking
          ? `${booking.dateLabel} · ${booking.timeLabel} · ${booking.guests} ${
              booking.guests === 1 ? "guest" : "guests"
            }`
          : ""
      }
      bodyClassName="px-5 py-4"
      footer={
        booking ? (
          <PosActionButton
            tone="green"
            disabled={selectedTables.length === 0}
            onClick={() =>
              selectedTables.length > 0 && onAssign(booking, selectedTables)
            }
          >
            {assignButtonLabel(selectedTables)}
          </PosActionButton>
        ) : null
      }
    >
      {booking ? (
        <div className="space-y-6">
          <dl>
            <DetailRow label="Phone" value={booking.phone} />
            <DetailRow label="Email" value={booking.email} />
            <DetailRow label="Date" value={booking.dateLabel} />
            <DetailRow label="Time" value={booking.timeLabel} />
            <DetailRow
              label="Party"
              value={`${booking.guests} ${booking.guests === 1 ? "guest" : "guests"}`}
            />
            {booking.assignedTables?.length ? (
              <DetailRow
                label={booking.assignedTables.length === 1 ? "Table" : "Tables"}
                value={booking.assignedTables.join(", ")}
              />
            ) : null}
            <DetailRow label="Note" value={booking.note?.trim()} />
          </dl>

          <div>
            <p className="text-sm font-semibold text-neutral-900">
              Available tables
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Select one or more. Availability is not checked yet.
              {selectedTables.length > 0
                ? ` ${selectedSeats} seats selected.`
                : ""}
            </p>
            <div className="mt-3 space-y-2">
              {tables.map((table) => {
                const selected = selectedTableIds.includes(table.id);
                return (
                  <button
                    key={table.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTable(table.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                      selected
                        ? "border-brand_accent bg-brand_accent/10"
                        : "border-neutral-200 bg-white hover:bg-neutral-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border",
                        selected
                          ? "border-brand_accent bg-brand_accent text-white"
                          : "border-neutral-300 bg-white",
                      )}
                      aria-hidden
                    >
                      {selected ? <Check size={14} strokeWidth={2.5} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-neutral-900">
                        Table {table.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {table.area}
                      </span>
                    </span>
                    <span className="text-sm text-neutral-600">
                      {table.seats} seats
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </SideDrawer>
  );
}
