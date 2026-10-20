"use client";

import * as React from "react";
import { format } from "date-fns";
import { ArrowRight, Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/UI/button";
import { Calendar } from "@/components/UI/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/UI/popover";

/**
 * DatePicker component with support for both single date and date range selection
 * @param {string|object} value - Selected date (string for single, object with from/to for range)
 * @param {function} onChange - Callback when date selection changes
 * @param {string} placeholder - Placeholder text when no date is selected
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Whether the picker is disabled
 * @param {boolean} enableDateRange - Enable date range selection mode
 * @param {boolean} showCloseButton - Show close button for range selection (default: true)
 * @param {object} props - Additional props passed to the button
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
  enableDateRange = false,
  showCloseButton = true,
  allowFutureDates = false,
  ...props
}) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (date, selected) => {
    if (enableDateRange) {
      // For date range, handle range selection
      if (date) {
        // check if the date range is already selected using current value
        if (value.from && value.to && value.from !== value.to) {
          // Date range is already selected, reset the range
          onChange({
            from: format(selected, "yyyy-MM-dd"),
            to: format(selected, "yyyy-MM-dd"),
          });
          // console.log("Date range selected before reset:", value);
        } else {
          // Date range is not selected, set the range normally
          onChange({
            from: format(date.from, "yyyy-MM-dd"),
            to: format(date.to, "yyyy-MM-dd"),
          });
        }
      }
    } else {
      // For single date, convert to YYYY-MM-DD format for consistency with native input
      if (date) {
        const formattedDate = format(date, "yyyy-MM-dd");
        onChange(formattedDate);
      }
      setOpen(false);
    }
  };

  const getDisplayValue = () => {
    if (!value) return placeholder;

    if (enableDateRange) {
      if (value.from && value.to) {
        return (
          <>
            {format(value.from, "MMM dd")} <ArrowRight />{" "}
            {format(value.to, "MMM dd, yyyy")}
          </>
        );
      } else if (value.from) {
        return format(value.from, "MMM dd, yyyy");
      }
      return placeholder;
    } else {
      return format(new Date(value), "PPP");
    }
  };

  const displayValue = getDisplayValue();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
          disabled={disabled}
        >
          <CalendarIcon className="h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode={enableDateRange ? "range" : "single"}
          disabled={
            allowFutureDates ? undefined : (date) => date > new Date()
          }
          captionLayout="dropdown"
          selected={
            enableDateRange ? value : value ? new Date(value) : undefined
          }
          onSelect={handleSelect}
          initialFocus
          {...props}
        />
        {enableDateRange && showCloseButton && (
          <div className="flex justify-end border-t p-3">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
