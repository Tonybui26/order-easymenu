import { resolvePosConfig } from "@/lib/pos/posConfig";

export function listActiveTimedServices(timedServices) {
  if (!Array.isArray(timedServices)) return [];
  return timedServices.filter(
    (service) =>
      service &&
      service.disabled !== true &&
      String(service.name || "").trim(),
  );
}

/**
 * The one timed service a table runs when manual open and close are both on.
 * Null when the store has none, more than one, or the flags are off.
 */
export function resolveSoleTableTimedService(menuConfig, timedServices) {
  if (menuConfig?.timedServicesEnabled !== true) return null;
  const posConfig = resolvePosConfig(menuConfig);
  if (
    posConfig.manualOpenTableEnabled !== true ||
    posConfig.manualCloseTableEnabled !== true
  ) {
    return null;
  }
  const active = listActiveTimedServices(timedServices);
  return active.length === 1 ? active[0] : null;
}

/**
 * Charge so far. Billed per started minute; an hourly rate is split evenly
 * across its 60 minutes. Rounded to cents.
 */
export function computeTimedServiceCharge(service, startedAt, now = Date.now()) {
  const start = new Date(startedAt).getTime();
  const price = Number(service?.price);
  if (!startedAt || Number.isNaN(start) || !Number.isFinite(price)) {
    return { minutes: 0, amount: 0 };
  }
  const elapsedMs = Math.max(0, now - start);
  const minutes = elapsedMs > 0 ? Math.ceil(elapsedMs / 60_000) : 0;
  const perMinute = service?.billingUnit === "minute" ? price : price / 60;
  return { minutes, amount: Math.round(perMinute * minutes * 100) / 100 };
}

export function formatServiceMinutes(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export function formatTimedServiceRate(service) {
  const amount = Number(service?.price);
  if (!Number.isFinite(amount)) return "";
  const unit = service?.billingUnit === "minute" ? "minute" : "hour";
  return `$${amount.toFixed(2)} per ${unit}`;
}
