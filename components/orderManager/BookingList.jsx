"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { Users } from "lucide-react";
import toast from "react-hot-toast";
import { assignBookingTables, fetchBookings } from "@/lib/api/fetchApi";
import PosChromeHeader from "./PosChromeHeader";
import PosActionButton from "./PosActionButton";
import BookingDetailsDrawer from "./BookingDetailsDrawer";
import BookingWeekCalendar from "./BookingWeekCalendar";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";
import { useMenuContext } from "@/components/context/MenuContext";
import { usePosNavigate } from "@/components/context/PosNavigateContext";

const TABS = [
  { id: "new", label: "New" },
  { id: "confirmed", label: "Confirmed" },
];

const TABLE_COLUMNS = [
  { key: "guest", label: "Guest", className: "min-w-[10rem]" },
  { key: "when", label: "When", className: "min-w-[8rem]" },
  { key: "party", label: "Party", className: "min-w-[6rem]" },
  { key: "contact", label: "Contact", className: "min-w-[10rem]" },
  { key: "note", label: "Note", className: "min-w-[10rem]" },
  { key: "action", label: "", className: "w-36" },
];

export default function BookingList() {
  const { handleOpenCashDrawer } = usePosOpenCashDrawer();
  const { menuConfig, dataLoaded } = useMenuContext();
  const { navigate } = usePosNavigate();
  const bookingEnabled = Boolean(menuConfig?.bookingEnabled);
  const [activeTab, setActiveTab] = useState("new");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [newBookings, setNewBookings] = useState([]);
  const [confirmedBookings, setConfirmedBookings] = useState([]);
  const [tables, setTables] = useState([]);
  const [weekRange, setWeekRange] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [loadError, setLoadError] = useState("");
  const counts = {
    new: newBookings.length,
    confirmed: confirmedBookings.length,
  };

  const handleVisibleWeekChange = useCallback((range) => {
    setWeekRange((current) =>
      current?.from === range.from && current?.to === range.to ? current : range,
    );
  }, []);

  useEffect(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    handleVisibleWeekChange({
      from: start.toISOString(),
      to: addDays(start, 7).toISOString(),
    });
  }, [handleVisibleWeekChange]);

  useEffect(() => {
    if (dataLoaded && !bookingEnabled) navigate("/");
  }, [bookingEnabled, dataLoaded, navigate]);

  useEffect(() => {
    if (!weekRange || !bookingEnabled) return undefined;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const waiting = await fetchBookings({ status: "new" });
        const confirmed = weekRange
          ? await fetchBookings({
              status: "confirmed",
              from: weekRange.from,
              to: weekRange.to,
            })
          : { bookings: [] };
        if (cancelled) return;
        setNewBookings((waiting.bookings || []).map(presentBooking));
        setConfirmedBookings((confirmed.bookings || []).map(presentBooking));
        if (Array.isArray(waiting.tables)) setTables(waiting.tables);
        setLoadError("");
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || "Could not load bookings");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bookingEnabled, weekRange, reloadKey]);

  async function handleAssign(booking, selectedTables) {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      await assignBookingTables(
        booking.id,
        selectedTables.map((table) => table.label),
      );
      toast.success(`${booking.name} confirmed`);
      setSelectedBooking(null);
      setReloadKey((current) => current + 1);
    } catch (error) {
      toast.error(error.message || "Could not assign tables");
    } finally {
      setIsAssigning(false);
    }
  }

  if (!dataLoaded || !bookingEnabled) return null;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8e8e8] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <PosChromeHeader onOpenCashDrawer={handleOpenCashDrawer} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f0f0f0] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-neutral-900">Booking</h1>
              <p className="mt-0.5 text-neutral-500">
                {activeTab === "new"
                  ? `${counts.new} waiting`
                  : `${counts.confirmed} confirmed`}
              </p>
            </div>

            <div
              className="flex shrink-0 space-x-1 rounded-xl bg-white p-1 shadow-sm"
              role="tablist"
              aria-label="Booking status"
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-4 py-2.5 text-base font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-brand_accent text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`ml-1.5 tabular-nums ${
                        isActive ? "text-white/80" : "text-gray-400"
                      }`}
                    >
                      ({counts[tab.id]})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {loadError ? (
            <p className="mb-3 shrink-0 text-sm text-red-600" role="alert">
              {loadError}
            </p>
          ) : null}

          <div
            className={`min-h-0 flex-1 ${
              activeTab === "confirmed" ? "overflow-hidden" : "overflow-y-auto"
            }`}
          >
            {isLoading && activeTab === "new" ? (
              <p className="px-2 py-8 text-sm text-neutral-500">
                Loading bookings…
              </p>
            ) : activeTab === "new" ? (
              <NewBookingTable
                bookings={newBookings}
                onView={setSelectedBooking}
              />
            ) : (
              <BookingWeekCalendar
                bookings={confirmedBookings}
                onSelectBooking={setSelectedBooking}
                onVisibleWeekChange={handleVisibleWeekChange}
              />
            )}
          </div>
        </div>
      </div>

      <BookingDetailsDrawer
        booking={selectedBooking}
        tables={tables}
        isAssigning={isAssigning}
        onClose={() => setSelectedBooking(null)}
        onAssign={handleAssign}
      />
    </div>
  );
}

function presentBooking(booking) {
  const startsAt = booking.startsAt ? new Date(booking.startsAt) : null;
  const hasTime = startsAt && !Number.isNaN(startsAt.getTime());
  return {
    ...booking,
    note: booking.note || "",
    dateLabel: hasTime ? format(startsAt, "EEE d MMM") : "",
    timeLabel: hasTime ? format(startsAt, "h:mm a") : "",
  };
}

function NewBookingTable({ bookings, onView }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-100/90">
              {TABLE_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 ${column.className}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td
                  colSpan={TABLE_COLUMNS.length}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  No new bookings
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {booking.name}
                    </div>
                    <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                      Waiting
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    <div>{booking.dateLabel}</div>
                    <div className="text-gray-500">{booking.timeLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4 text-gray-400" aria-hidden />
                      {booking.guests}{" "}
                      {booking.guests === 1 ? "guest" : "guests"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    <div>{booking.phone}</div>
                    <div className="text-gray-500">{booking.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {(booking.note || "").trim() || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <PosActionButton
                      tone="blue"
                      className="py-2 text-sm"
                      onClick={() => onView(booking)}
                    >
                      View
                    </PosActionButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
