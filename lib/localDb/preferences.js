import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "@/lib/helper/platformDetection";

/**
 * Thin Preferences wrapper for Local Mode device state (last sync, flags).
 * Falls back to localStorage on web so helpers stay callable in the browser.
 */

const WEB_PREFIX = "easymenu.local.";

export async function getLocalPreference(key) {
  if (!key) return null;

  if (isNativeApp()) {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  }

  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${WEB_PREFIX}${key}`);
}

export async function setLocalPreference(key, value) {
  if (!key) return;

  if (isNativeApp()) {
    if (value == null) {
      await Preferences.remove({ key });
      return;
    }
    await Preferences.set({ key, value: String(value) });
    return;
  }

  if (typeof window === "undefined") return;
  if (value == null) {
    window.localStorage.removeItem(`${WEB_PREFIX}${key}`);
    return;
  }
  window.localStorage.setItem(`${WEB_PREFIX}${key}`, String(value));
}

export async function removeLocalPreference(key) {
  await setLocalPreference(key, null);
}
