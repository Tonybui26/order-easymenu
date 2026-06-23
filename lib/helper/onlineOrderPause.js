export const ONLINE_ORDER_PAUSE_MS = 30 * 60 * 1000;

function isPauseExpired(pausedUntil, now = new Date()) {
  if (!pausedUntil) return false;
  const expiry = new Date(pausedUntil);
  if (Number.isNaN(expiry.getTime())) return false;
  return now >= expiry;
}

export function isTakeawayOnlineOrderPaused(menuConfig, now = new Date()) {
  const config = menuConfig || {};
  if (config.takeawayOnlineOrderEnabled) return false;
  if (isPauseExpired(config.takeawayOnlinePausedUntil, now)) return false;
  return true;
}

export function isDineInOnlineOrderPaused(menuConfig, now = new Date()) {
  const config = menuConfig || {};
  if (config.dineInOnlineOrderEnabled !== false) return false;
  if (isPauseExpired(config.dineInOnlinePausedUntil, now)) return false;
  return true;
}

export function isTakeawayOnlineOrderAvailable(menuConfig, now = new Date()) {
  return !isTakeawayOnlineOrderPaused(menuConfig, now);
}

export function isDineInOnlineOrderAvailable(menuConfig, now = new Date()) {
  return !isDineInOnlineOrderPaused(menuConfig, now);
}

export function buildTakeawayOnlineOrderPauseUpdate(menuConfig, pausing, now = new Date()) {
  if (pausing) {
    return {
      ...menuConfig,
      takeawayOnlineOrderEnabled: false,
      takeawayOnlinePausedUntil: new Date(
        now.getTime() + ONLINE_ORDER_PAUSE_MS,
      ).toISOString(),
    };
  }
  return {
    ...menuConfig,
    takeawayOnlineOrderEnabled: true,
    takeawayOnlinePausedUntil: null,
  };
}

export function buildDineInOnlineOrderPauseUpdate(menuConfig, pausing, now = new Date()) {
  if (pausing) {
    return {
      ...menuConfig,
      dineInOnlineOrderEnabled: false,
      dineInOnlinePausedUntil: new Date(
        now.getTime() + ONLINE_ORDER_PAUSE_MS,
      ).toISOString(),
    };
  }
  return {
    ...menuConfig,
    dineInOnlineOrderEnabled: true,
    dineInOnlinePausedUntil: null,
  };
}

export function formatPauseResumeTime(pausedUntil, now = new Date()) {
  if (!pausedUntil) return null;
  const expiry = new Date(pausedUntil);
  if (Number.isNaN(expiry.getTime()) || now >= expiry) return null;
  return expiry.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
