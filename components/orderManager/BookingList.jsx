"use client";

import { useEffect, useState } from "react";
import { addDays, format, setHours, setMinutes, startOfWeek } from "date-fns";
import { Users } from "lucide-react";
import toast from "react-hot-toast";
import PosChromeHeader from "./PosChromeHeader";
import PosActionButton from "./PosActionButton";
import BookingDetailsDrawer from "./BookingDetailsDrawer";
import BookingWeekCalendar from "./BookingWeekCalendar";
import { usePosOpenCashDrawer } from "./usePosOpenCashDrawer";

const TABS = [
  { id: "new", label: "New" },
  { id: "confirmed", label: "Confirmed" },
];

/** Preview rows only. Nothing is loaded from the booking API yet. */
const SAMPLE_NEW_BOOKINGS = [
  {
    id: "preview-1",
    name: "Alex Chen",
    phone: "0412 345 678",
    email: "alex@email.com",
    guests: 2,
    dateLabel: "Tue 6 Oct",
    timeLabel: "7:00 PM",
    note: "Window seat if possible",
  },
  {
    id: "preview-2",
    name: "Priya Shah",
    phone: "0491 876 543",
    email: "priya@email.com",
    guests: 4,
    dateLabel: "Wed 7 Oct",
    timeLabel: "12:30 PM",
    note: "High chair",
  },
  {
    id: "preview-3",
    name: "Jordan Lee",
    phone: "0400 112 233",
    email: "jordan@email.com",
    guests: 6,
    dateLabel: "Fri 9 Oct",
    timeLabel: "6:30 PM",
    note: "",
  },
];

/** Offsets from Monday of the current week. Preview rows only. */
const SAMPLE_CONFIRMED_SPECS = [
  {
    id: "confirmed-1",
    day: 0,
    hour: 11,
    minute: 30,
    name: "Sam Nguyen",
    phone: "0422 100 200",
    email: "sam@email.com",
    guests: 3,
    note: "Birthday",
    assignedTables: ["8"],
  },
  {
    id: "confirmed-2",
    day: 1,
    hour: 12,
    minute: 0,
    name: "Mia Rossi",
    phone: "0411 222 333",
    email: "mia@email.com",
    guests: 2,
    note: "",
    assignedTables: ["4"],
  },
  {
    id: "confirmed-12",
    day: 1,
    hour: 12,
    minute: 0,
    name: "Ben Walsh",
    phone: "0414 220 118",
    email: "ben@email.com",
    guests: 3,
    note: "",
    assignedTables: ["8"],
  },
  {
    id: "confirmed-3",
    day: 1,
    hour: 12,
    minute: 30,
    name: "Nina Alvarez",
    phone: "0423 818 404",
    email: "nina@email.com",
    guests: 2,
    note: "",
    assignedTables: ["15"],
  },
  {
    id: "confirmed-13",
    day: 1,
    hour: 12,
    minute: 30,
    name: "Sophie Grant",
    phone: "0428 551 303",
    email: "sophie@email.com",
    guests: 4,
    note: "",
    assignedTables: ["12"],
  },
  {
    id: "confirmed-4",
    day: 1,
    hour: 19,
    minute: 0,
    name: "Harper Cole",
    phone: "0418 909 111",
    email: "harper@email.com",
    guests: 4,
    note: "Anniversary",
    assignedTables: ["8", "15"],
  },
  {
    id: "confirmed-5",
    day: 1,
    hour: 19,
    minute: 0,
    name: "Owen Blake",
    phone: "0417 300 212",
    email: "owen@email.com",
    guests: 2,
    note: "",
    assignedTables: ["4"],
  },
  {
    id: "confirmed-6",
    day: 2,
    hour: 18,
    minute: 30,
    name: "Chris Patel",
    phone: "0433 444 555",
    email: "chris@email.com",
    guests: 2,
    note: "",
    assignedTables: ["4"],
  },
  {
    id: "confirmed-7",
    day: 3,
    hour: 12,
    minute: 30,
    name: "Elena Brooks",
    phone: "0401 555 666",
    email: "elena@email.com",
    guests: 4,
    note: "High chair",
    assignedTables: ["8"],
  },
  {
    id: "confirmed-8",
    day: 4,
    hour: 13,
    minute: 0,
    name: "Noah Kim",
    phone: "0455 777 888",
    email: "noah@email.com",
    guests: 2,
    note: "Quiet table",
    assignedTables: ["15"],
  },
  {
    id: "confirmed-9",
    day: 5,
    hour: 18,
    minute: 30,
    name: "Ava Rahman",
    phone: "0400 222 444",
    email: "ava@email.com",
    guests: 6,
    note: "",
    assignedTables: ["12", "15"],
  },
  {
    id: "confirmed-10",
    day: 5,
    hour: 18,
    minute: 30,
    name: "Jules Park",
    phone: "0431 660 909",
    email: "jules@email.com",
    guests: 2,
    note: "",
    assignedTables: ["4"],
  },
  {
    id: "confirmed-11",
    day: 6,
    hour: 19,
    minute: 0,
    name: "Leo Martin",
    phone: "0466 333 222",
    email: "leo@email.com",
    guests: 2,
    note: "",
    assignedTables: ["4"],
  },
];

/** Placeholder floor. Real availability rules are not decided yet. */
const SAMPLE_TABLES = [
  { id: "t4", label: "4", seats: 2, area: "Window" },
  { id: "t8", label: "8", seats: 4, area: "Main" },
  { id: "t12", label: "12", seats: 6, area: "Patio" },
  { id: "t15", label: "15", seats: 4, area: "Main" },
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
  const [activeTab, setActiveTab] = useState("new");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [confirmedBookings, setConfirmedBookings] = useState([]);
  const counts = {
    new: SAMPLE_NEW_BOOKINGS.length,
    confirmed: SAMPLE_CONFIRMED_SPECS.length,
  };

  useEffect(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    setConfirmedBookings(
      SAMPLE_CONFIRMED_SPECS.map((spec) => {
        const startsAt = setMinutes(
          setHours(addDays(weekStart, spec.day), spec.hour),
          spec.minute,
        );
        return {
          ...spec,
          startsAt: startsAt.toISOString(),
          dateLabel: format(startsAt, "EEE d MMM"),
          timeLabel: format(startsAt, "h:mm a"),
        };
      }),
    );
  }, []);

  function handleAssign(booking, tables) {
    const labels = tables.map((table) => table.label).join(", ");
    const noun = tables.length === 1 ? "Table" : "Tables";
    toast(`${booking.name} → ${noun} ${labels} — preview only`);
    setSelectedBooking(null);
  }

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

          <div
            className={`min-h-0 flex-1 ${
              activeTab === "confirmed" ? "overflow-hidden" : "overflow-y-auto"
            }`}
          >
            {activeTab === "new" ? (
              <NewBookingTable
                bookings={SAMPLE_NEW_BOOKINGS}
                onView={setSelectedBooking}
              />
            ) : (
              <BookingWeekCalendar
                bookings={confirmedBookings}
                onSelectBooking={setSelectedBooking}
              />
            )}
          </div>
        </div>
      </div>

      <BookingDetailsDrawer
        booking={selectedBooking}
        tables={SAMPLE_TABLES}
        onClose={() => setSelectedBooking(null)}
        onAssign={handleAssign}
      />
    </div>
  );
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
                    {booking.note.trim() || "—"}
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
