/**
 * Compact pickup / delivery time labels for Order Manager (AU date style: dd/mm, no year).
 */

const TIME_ONLY = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;
const DATED = /^(\d{4}-\d{2}-\d{2})\s+(.+)$/i;

function localDayKeyFromDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parse12hToMinutesFromMidnight(time12h) {
  const s = String(time12h ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  const total = h * 60 + min;
  if (total < 0 || total > 1439) return null;
  return total;
}

function minutesTo12h(minutes) {
  const h24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(min).padStart(2, "0")} ${ap}`;
}

/** @returns {{ mode: "asap" } | { mode: "today", time: string } | { mode: "scheduled", dateIso: string, time: string }} */
function parsePickupTimeSelection(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "ASAP") return { mode: "asap" };
  const m = s.match(DATED);
  if (m && TIME_ONLY.test(String(m[2]).trim())) {
    return { mode: "scheduled", dateIso: m[1], time: String(m[2]).trim() };
  }
  if (TIME_ONLY.test(s)) return { mode: "today", time: s };
  return { mode: "asap" };
}

/**
 * @returns {{ dateKey: string, minutesFromMidnight: number, time12h: string } | null}
 */
function resolveFulfillmentTarget(order, now = new Date()) {
  const fs = order?.fulfillmentSchedule;
  if (
    fs?.dateKey &&
    typeof fs.minutesFromMidnight === "number" &&
    Number.isFinite(fs.minutesFromMidnight)
  ) {
    return {
      dateKey: fs.dateKey,
      minutesFromMidnight: fs.minutesFromMidnight,
      time12h: minutesTo12h(fs.minutesFromMidnight),
    };
  }

  const parsed = parsePickupTimeSelection(order?.pickupTime);
  if (parsed.mode === "scheduled") {
    const mins = parse12hToMinutesFromMidnight(parsed.time);
    if (mins === null) return null;
    return {
      dateKey: parsed.dateIso,
      minutesFromMidnight: mins,
      time12h: parsed.time,
    };
  }
  if (parsed.mode === "today") {
    const mins = parse12hToMinutesFromMidnight(parsed.time);
    if (mins === null) return null;
    return {
      dateKey: localDayKeyFromDate(now),
      minutesFromMidnight: mins,
      time12h: parsed.time,
    };
  }
  return null;
}

function buildTargetDate(dateKey, minutesFromMidnight) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Math.floor(minutesFromMidnight / 60);
  const min = minutesFromMidnight % 60;
  return new Date(y, mo - 1, d, h, min, 0, 0);
}

const SCHEDULED_OVERDUE_GRACE_MINUTES = 7;

function formatMinutesDuration(totalMinutes) {
  if (totalMinutes < 60) {
    return `${totalMinutes} min${totalMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const rem = totalMinutes % 60;
  if (rem === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${rem} min${rem === 1 ? "" : "s"}`;
}

function formatRelativeDuration(
  targetDate,
  now = new Date(),
  { graceMinutes = 0 } = {},
) {
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs > 0) {
    const totalMinutes = Math.ceil(diffMs / 60000);
    return {
      direction: "future",
      text: formatMinutesDuration(totalMinutes),
    };
  }

  const elapsedMs = -diffMs;
  if (elapsedMs <= graceMinutes * 60000) {
    return { direction: "now", text: "now" };
  }

  const totalMinutes = Math.floor(elapsedMs / 60000);
  return {
    direction: "past",
    text: formatMinutesDuration(totalMinutes),
  };
}

/**
 * @param {string} isoYmd — `YYYY-MM-DD`
 * @returns {"Today" | "Tomorrow" | string} — Today, Tomorrow, or `dd/mm`
 */
export function formatRelativeCalendarDayShort(isoYmd) {
  const raw = String(isoYmd ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const target = new Date(y, mo - 1, d);
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const tt = target.getTime();
  if (tt === todayStart.getTime()) return "Today";
  if (tt === tomorrowStart.getTime()) return "Tomorrow";
  return `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}`;
}

/**
 * Short single-line label for order cards (e.g. `Today, 6:15 PM`, `26/06, 6:15 PM`, `ASAP`).
 */
export function formatPickupTimeShort(pickupTime) {
  const raw = String(pickupTime ?? "").trim();
  if (!raw || raw === "ASAP") return "ASAP";

  const dated = raw.match(DATED);
  if (dated) {
    const dayWord = formatRelativeCalendarDayShort(dated[1]);
    return `${dayWord}, ${dated[2].trim()}`;
  }

  if (/^(today|tomorrow)\s+/i.test(raw)) {
    const first = raw.split(/\s+/)[0];
    const dayWord = first[0].toUpperCase() + first.slice(1).toLowerCase();
    const time = raw.replace(/^(today|tomorrow)\s+/i, "").trim();
    return time ? `${dayWord}, ${time}` : dayWord;
  }

  if (TIME_ONLY.test(raw)) {
    return `Today, ${raw}`;
  }

  return raw;
}

/**
 * Scheduled-tab label: relative countdown for today, tomorrow + time, or dd/mm + time.
 * @param {{ pickupTime?: string, fulfillmentSchedule?: { dateKey?: string, minutesFromMidnight?: number } }} order
 * @param {{ isDelivery?: boolean, now?: Date }} [options]
 */
export function formatScheduledExpectedLabel(order, options = {}) {
  const { isDelivery = false, now = new Date() } = options;
  const channel = isDelivery ? "Delivery" : "Pickup";
  const target = resolveFulfillmentTarget(order, now);

  if (!target) {
    const fallback = formatPickupTimeShort(order?.pickupTime);
    return fallback === "ASAP"
      ? `${channel} expected soon`
      : `${channel} expected ${fallback}`;
  }

  const targetDate = buildTargetDate(
    target.dateKey,
    target.minutesFromMidnight,
  );
  if (!targetDate) {
    return `${channel} expected ${formatPickupTimeShort(order?.pickupTime)}`;
  }

  const todayKey = localDayKeyFromDate(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = localDayKeyFromDate(tomorrowDate);

  const { direction, text } = formatRelativeDuration(targetDate, now, {
    graceMinutes: SCHEDULED_OVERDUE_GRACE_MINUTES,
  });

  if (direction === "past") {
    return `${channel} expected ${text} ago`;
  }

  if (direction === "now") {
    return `${channel} expected now`;
  }

  if (target.dateKey === todayKey) {
    return `${channel} expected in ${text}`;
  }

  if (target.dateKey === tomorrowKey) {
    return `${channel} expected tomorrow at ${target.time12h}`;
  }

  const dateLabel = formatRelativeCalendarDayShort(target.dateKey);
  return `${channel} expected on ${dateLabel} at ${target.time12h}`;
}

/**
 * @returns {"future" | "now" | "past" | null}
 */
function getScheduledFulfillmentDirection(order, { now = new Date() } = {}) {
  const target = resolveFulfillmentTarget(order, now);
  if (!target) return null;

  const targetDate = buildTargetDate(
    target.dateKey,
    target.minutesFromMidnight,
  );
  if (!targetDate) return null;

  const { direction } = formatRelativeDuration(targetDate, now, {
    graceMinutes: SCHEDULED_OVERDUE_GRACE_MINUTES,
  });
  return direction;
}

/**
 * True when the scheduled slot is past the overdue grace period.
 * @param {{ pickupTime?: string, fulfillmentSchedule?: { dateKey?: string, minutesFromMidnight?: number } }} order
 * @param {{ now?: Date }} [options]
 */
export function isScheduledFulfillmentOverdue(order, { now = new Date() } = {}) {
  return getScheduledFulfillmentDirection(order, { now }) === "past";
}

/**
 * True during the grace window when the label shows "expected now".
 * @param {{ pickupTime?: string, fulfillmentSchedule?: { dateKey?: string, minutesFromMidnight?: number } }} order
 * @param {{ now?: Date }} [options]
 */
export function isScheduledFulfillmentInGrace(order, { now = new Date() } = {}) {
  return getScheduledFulfillmentDirection(order, { now }) === "now";
}
