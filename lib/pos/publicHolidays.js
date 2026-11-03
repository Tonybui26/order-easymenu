/**
 * Australian public holidays used by the Holiday surcharge and the admin schedule.
 * Keep this list in sync with order-easymenu/lib/pos/publicHolidays.js.
 *
 * Statewide days for 2026–2028. National days apply in every state.
 * A missing or non-Australian state uses national days only.
 * Regional show days, part-day Christmas Eve / New Year's Eve, and
 * public-service-only days are left out.
 */

const STATE_CODES = {
  act: "ACT",
  "australian capital territory": "ACT",
  nsw: "NSW",
  "new south wales": "NSW",
  nt: "NT",
  "northern territory": "NT",
  qld: "QLD",
  queensland: "QLD",
  sa: "SA",
  "south australia": "SA",
  tas: "TAS",
  tasmania: "TAS",
  vic: "VIC",
  victoria: "VIC",
  wa: "WA",
  "western australia": "WA",
};

const STATE_LABELS = {
  ACT: "Australian Capital Territory",
  NSW: "New South Wales",
  NT: "Northern Territory",
  QLD: "Queensland",
  SA: "South Australia",
  TAS: "Tasmania",
  VIC: "Victoria",
  WA: "Western Australia",
};

/** @type {Array<[string, string, string]>} date, name, "*" or comma-separated state codes */
const PUBLIC_HOLIDAYS = [
  ["2026-01-01", "New Year's Day", "*"],
  ["2026-01-26", "Australia Day", "*"],
  ["2026-03-02", "Labour Day", "WA"],
  ["2026-03-09", "Labour Day", "VIC,TAS"],
  ["2026-03-09", "Canberra Day", "ACT"],
  ["2026-03-09", "Adelaide Cup Day", "SA"],
  ["2026-04-03", "Good Friday", "*"],
  ["2026-04-04", "Easter Saturday", "ACT,NSW,NT,QLD,SA,VIC"],
  ["2026-04-05", "Easter Sunday", "ACT,NSW,NT,QLD,SA,VIC,WA"],
  ["2026-04-06", "Easter Monday", "*"],
  ["2026-04-25", "Anzac Day", "*"],
  ["2026-04-27", "Anzac Day holiday", "ACT,NSW,WA"],
  ["2026-05-04", "Labour Day", "QLD"],
  ["2026-05-04", "May Day", "NT"],
  ["2026-06-01", "Reconciliation Day", "ACT"],
  ["2026-06-01", "Western Australia Day", "WA"],
  ["2026-06-08", "King's Birthday", "ACT,NSW,NT,SA,TAS,VIC"],
  ["2026-08-03", "Picnic Day", "NT"],
  ["2026-09-28", "King's Birthday", "WA"],
  ["2026-10-05", "Labour Day", "ACT,NSW,SA"],
  ["2026-10-05", "King's Birthday", "QLD"],
  ["2026-11-03", "Melbourne Cup", "VIC"],
  ["2026-12-25", "Christmas Day", "*"],
  ["2026-12-26", "Boxing Day", "ACT,NSW,NT,QLD,SA,VIC,WA"],
  ["2026-12-28", "Boxing Day holiday", "*"],

  ["2027-01-01", "New Year's Day", "*"],
  ["2027-01-26", "Australia Day", "*"],
  ["2027-03-01", "Labour Day", "WA"],
  ["2027-03-08", "Labour Day", "VIC,TAS"],
  ["2027-03-08", "Canberra Day", "ACT"],
  ["2027-03-08", "Adelaide Cup Day", "SA"],
  ["2027-03-26", "Good Friday", "*"],
  ["2027-03-27", "Easter Saturday", "ACT,NSW,NT,QLD,SA,VIC"],
  ["2027-03-28", "Easter Sunday", "ACT,NSW,NT,QLD,SA,VIC,WA"],
  ["2027-03-29", "Easter Monday", "*"],
  ["2027-04-25", "Anzac Day", "ACT,NSW,SA,TAS,VIC,WA"],
  ["2027-04-26", "Anzac Day holiday", "ACT,NSW,NT,QLD,WA"],
  ["2027-05-03", "Labour Day", "QLD"],
  ["2027-05-03", "May Day", "NT"],
  ["2027-05-31", "Reconciliation Day", "ACT"],
  ["2027-06-07", "Western Australia Day", "WA"],
  ["2027-06-14", "King's Birthday", "ACT,NSW,NT,SA,TAS,VIC"],
  ["2027-08-02", "Picnic Day", "NT"],
  ["2027-09-27", "King's Birthday", "WA"],
  ["2027-10-04", "Labour Day", "ACT,NSW,SA"],
  ["2027-10-04", "King's Birthday", "QLD"],
  ["2027-11-02", "Melbourne Cup", "VIC"],
  ["2027-12-25", "Christmas Day", "*"],
  ["2027-12-26", "Boxing Day", "ACT,NSW,NT,QLD,TAS,VIC,WA"],
  ["2027-12-27", "Christmas Day holiday", "*"],
  ["2027-12-28", "Boxing Day holiday", "ACT,NSW,NT,QLD,TAS,VIC,WA"],
  ["2027-12-28", "Proclamation Day", "SA"],

  ["2028-01-01", "New Year's Day", "*"],
  ["2028-01-03", "New Year's Day holiday", "*"],
  ["2028-01-26", "Australia Day", "*"],
  ["2028-03-13", "Labour Day", "VIC,TAS,WA"],
  ["2028-03-13", "Canberra Day", "ACT"],
  ["2028-03-13", "Adelaide Cup Day", "SA"],
  ["2028-04-14", "Good Friday", "*"],
  ["2028-04-15", "Easter Saturday", "ACT,NSW,NT,QLD,SA,VIC,WA"],
  ["2028-04-16", "Easter Sunday", "ACT,NSW,NT,QLD,SA,VIC,WA"],
  ["2028-04-17", "Easter Monday", "*"],
  ["2028-04-25", "Anzac Day", "*"],
  ["2028-05-01", "Labour Day", "QLD"],
  ["2028-05-01", "May Day", "NT"],
  ["2028-05-29", "Reconciliation Day", "ACT"],
  ["2028-06-12", "King's Birthday", "ACT,NSW,NT,SA,TAS,VIC,WA"],
  ["2028-08-07", "Picnic Day", "NT"],
  ["2028-10-02", "Labour Day", "ACT,NSW,SA"],
  ["2028-10-02", "King's Birthday", "QLD"],
  ["2028-11-07", "Melbourne Cup", "VIC"],
  ["2028-11-13", "Western Australia Day", "WA"],
  ["2028-12-25", "Christmas Day", "*"],
  ["2028-12-26", "Boxing Day", "*"],
];

/**
 * @param {string | null | undefined} stateOrRegion
 * @returns {"ACT" | "NSW" | "NT" | "QLD" | "SA" | "TAS" | "VIC" | "WA" | null}
 */
export function normalizeAustralianState(stateOrRegion) {
  const key = String(stateOrRegion || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
  return STATE_CODES[key] || null;
}

/**
 * @param {string | null | undefined} stateOrRegion
 * @returns {string}
 */
export function australianStateLabel(stateOrRegion) {
  const code = normalizeAustralianState(stateOrRegion);
  return code ? STATE_LABELS[code] : "";
}

function holidayApplies(states, stateCode) {
  if (states === "*") return true;
  if (!stateCode) return false;
  return states.split(",").includes(stateCode);
}

/**
 * Calendar day in the store timezone, YYYY-MM-DD.
 * @param {Date} date
 * @param {string} [timeZone]
 */
export function storeLocalDateKey(date = new Date(), timeZone) {
  const zone = String(timeZone || "").trim();
  if (zone) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    } catch {
      // Invalid zone — use the runtime local calendar day.
    }
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * @param {Date} [date]
 * @param {string} [timeZone]
 * @param {string} [stateOrRegion]
 */
export function isPublicHoliday(date = new Date(), timeZone, stateOrRegion) {
  const key = storeLocalDateKey(date, timeZone);
  const stateCode = normalizeAustralianState(stateOrRegion);
  return PUBLIC_HOLIDAYS.some(
    ([holidayDate, , states]) =>
      holidayDate === key && holidayApplies(states, stateCode),
  );
}

/**
 * Holidays from the store's today through the last date in this list.
 * @param {Date} [date]
 * @param {string} [timeZone]
 * @param {string} [stateOrRegion]
 * @returns {Array<{ date: string, name: string, isToday: boolean }>}
 */
export function upcomingPublicHolidays(
  date = new Date(),
  timeZone,
  stateOrRegion,
) {
  const today = storeLocalDateKey(date, timeZone);
  const stateCode = normalizeAustralianState(stateOrRegion);
  return PUBLIC_HOLIDAYS.filter(
    ([holidayDate, , states]) =>
      holidayDate >= today && holidayApplies(states, stateCode),
  ).map(([holidayDate, name]) => ({
    date: holidayDate,
    name,
    isToday: holidayDate === today,
  }));
}

/**
 * @param {string} dateKey YYYY-MM-DD
 * @returns {string}
 */
export function formatPublicHolidayDate(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(utcNoon);
}
