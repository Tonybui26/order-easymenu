/** Running clock for how long a table sitting has been open. Same shape as held cards. */
export function formatTableOpenDuration(startedAt, now = Date.now()) {
  const start = new Date(startedAt).getTime();
  if (!startedAt || Number.isNaN(start)) return "";
  const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** Earliest open-round start among the given seat names. */
export function startedAtForTableNames(rounds, tableNames) {
  const keys = new Set(
    (tableNames || [])
      .map((name) => String(name || "").trim().toLowerCase())
      .filter(Boolean),
  );
  if (!keys.size) return null;

  let earliest = null;
  for (const round of rounds || []) {
    const seats = round?.tables || [];
    const matches = seats.some((name) =>
      keys.has(String(name || "").trim().toLowerCase()),
    );
    if (!matches) continue;
    const time = new Date(round.startedAt).getTime();
    if (Number.isNaN(time)) continue;
    if (earliest == null || time < earliest) earliest = time;
  }

  return earliest == null ? null : new Date(earliest).toISOString();
}
