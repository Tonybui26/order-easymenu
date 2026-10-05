"use client";

import { useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/helper";

const WEEK_STARTS_ON = 1;
const START_HOUR = 11;
const END_HOUR = 21;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, index) => START_HOUR + index,
);
const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function BookingWeekCalendar({ bookings, onSelectBooking }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(null);

  useEffect(() => {
    const today = startOfDay(new Date());
    setSelectedDate(today);
    setVisibleMonth(startOfMonth(today));
  }, []);

  useEffect(() => {
    if (selectedDate) setVisibleMonth(startOfMonth(selectedDate));
  }, [selectedDate]);

  if (!selectedDate || !visibleMonth) {
    return <div className="h-full rounded-xl border border-neutral-200 bg-white" />;
  }

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <MiniMonth
        visibleMonth={visibleMonth}
        selectedDate={selectedDate}
        onShiftMonth={(delta) =>
          setVisibleMonth((month) => addMonths(month, delta))
        }
        onSelectDate={setSelectedDate}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-neutral-900">Calendar</h2>
            <p className="text-sm text-neutral-500">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <CalendarNavButton
              label="Previous week"
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
            >
              <ChevronLeft size={16} />
            </CalendarNavButton>
            <CalendarNavButton
              label="Next week"
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
            >
              <ChevronRight size={16} />
            </CalendarNavButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div
            className="grid min-w-[880px]"
            style={{
              gridTemplateColumns: "5.75rem repeat(7, minmax(7.5rem, 1fr))",
            }}
          >
            <div className="sticky left-0 top-0 z-30 border-b border-neutral-200 bg-white" />
            {weekDays.map((day) => {
              const selected = isSameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "sticky top-0 z-20 border-b border-l border-neutral-200 px-2 py-3 text-center transition-colors",
                    selected
                      ? "bg-brand_accent text-white"
                      : "bg-neutral-50 text-neutral-900 hover:bg-neutral-100",
                  )}
                >
                  <span
                    className={cn(
                      "block text-xs font-medium",
                      selected ? "text-white/80" : "text-neutral-500",
                    )}
                  >
                    {format(day, "EEE")}
                  </span>
                  <span className="mt-0.5 block text-xl font-semibold leading-none">
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}

            {HOURS.map((hour) => (
              <HourRow
                key={hour}
                hour={hour}
                weekDays={weekDays}
                bookings={bookings}
                onSelectBooking={onSelectBooking}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniMonth({ visibleMonth, selectedDate, onShiftMonth, onSelectDate }) {
  const gridStart = startOfWeek(startOfMonth(visibleMonth), {
    weekStartsOn: WEEK_STARTS_ON,
  });
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  return (
    <aside className="hidden w-[232px] shrink-0 border-r border-neutral-200 p-4 lg:block">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">
          {format(visibleMonth, "MMMM yyyy")}
        </p>
        <div className="flex gap-1">
          <CalendarNavButton
            label="Previous month"
            onClick={() => onShiftMonth(-1)}
          >
            <ChevronLeft size={16} />
          </CalendarNavButton>
          <CalendarNavButton label="Next month" onClick={() => onShiftMonth(1)}>
            <ChevronRight size={16} />
          </CalendarNavButton>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="py-1 text-[11px] font-medium text-neutral-400"
          >
            {label}
          </span>
        ))}
        {days.map((day) => {
          const selected = isSameDay(day, selectedDate);
          const inMonth = isSameMonth(day, visibleMonth);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-pressed={selected}
              aria-label={format(day, "EEEE, MMMM d, yyyy")}
              onClick={() => onSelectDate(startOfDay(day))}
              className={cn(
                "mx-auto my-0.5 flex size-8 items-center justify-center rounded-full text-sm transition-colors",
                selected && "bg-brand_accent font-semibold text-white",
                !selected &&
                  isToday &&
                  "font-semibold text-brand_accent ring-1 ring-brand_accent",
                !selected &&
                  !isToday &&
                  inMonth &&
                  "text-neutral-800 hover:bg-neutral-100",
                !selected && !isToday && !inMonth && "text-neutral-300 hover:bg-neutral-50",
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function HourRow({ hour, weekDays, bookings, onSelectBooking }) {
  const label = format(setHours(new Date(2020, 0, 1), hour), "h:mm a");

  return (
    <>
      <div className="sticky left-0 z-10 border-b border-neutral-200 bg-white px-2 pt-1.5 text-[11px] font-medium text-neutral-400">
        {label}
      </div>
      {weekDays.map((day) => {
        const events = bookingsForCell(bookings, day, hour);
        return (
          <div
            key={`${day.toISOString()}-${hour}`}
            className="min-h-[4.75rem] border-b border-l border-neutral-200 p-1"
          >
            <div className="space-y-1">
              {events.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onSelectBooking(booking)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-left shadow-sm transition-colors hover:border-brand_accent/50"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-brand_accent"
                      aria-hidden
                    />
                    <span className="truncate text-xs font-semibold text-neutral-900">
                      {booking.name}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate pl-3 text-[11px] text-neutral-500">
                    {booking.timeLabel}
                  </span>
                  <span className="block truncate pl-3 text-[11px] text-neutral-400">
                    {booking.guests}{" "}
                    {booking.guests === 1 ? "guest" : "guests"}
                    {booking.assignedTables?.length
                      ? ` · ${
                          booking.assignedTables.length === 1 ? "Table" : "Tables"
                        } ${booking.assignedTables.join(", ")}`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function CalendarNavButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50"
    >
      {children}
    </button>
  );
}

function bookingsForCell(bookings, day, hour) {
  return bookings
    .filter((booking) => {
      const start = new Date(booking.startsAt);
      return isSameDay(start, day) && start.getHours() === hour;
    })
    .sort(
      (left, right) =>
        new Date(left.startsAt).getMinutes() - new Date(right.startsAt).getMinutes(),
    );
}
