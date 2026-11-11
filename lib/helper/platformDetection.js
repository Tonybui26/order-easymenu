/**
 * Platform detection utilities for distinguishing between web and mobile native app environments
 */

/**
 * Detects if the app is running in a Capacitor native environment
 * @returns {boolean} True if running in native app, false if web
 */
export function isNativeApp() {
  // Check if we're in a browser environment first
  if (typeof window === "undefined") {
    return false;
  }

  // Check for Capacitor's presence
  if (window.Capacitor) {
    return window.Capacitor.isNativePlatform();
  }

  // Fallback check for Capacitor global
  return (
    typeof window.Capacitor !== "undefined" &&
    window.Capacitor.platform !== "web"
  );
}

/**
 * Gets the current platform name
 * @returns {string} Platform name ('ios', 'android', or 'web')
 */
export function getPlatform() {
  if (typeof window === "undefined") {
    return "web";
  }

  if (window.Capacitor) {
    return window.Capacitor.getPlatform();
  }

  return "web";
}

/**
 * Checks if running on iOS native app
 * @returns {boolean}
 */
export function isIOS() {
  return getPlatform() === "ios";
}

/**
 * Checks if running on Android native app
 * @returns {boolean}
 */
export function isAndroid() {
  return getPlatform() === "android";
}

/**
 * Checks if running in web browser
 * @returns {boolean}
 */
export function isWeb() {
  return getPlatform() === "web";
}

/**
 * OS for Order Manager device labels.
 * Prefers Capacitor (`ios` / `android`); falls back to user-agent.
 * Never returns "web" — OM is a Capacitor app and that label confuses staff.
 * @returns {"ios"|"android"|"unknown"}
 */
export function getOrderManagerOs() {
  if (typeof window === "undefined") return "unknown";

  const capacitorPlatform =
    typeof window.Capacitor?.getPlatform === "function"
      ? window.Capacitor.getPlatform()
      : null;
  if (capacitorPlatform === "ios" || capacitorPlatform === "android") {
    return capacitorPlatform;
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (
    typeof navigator !== "undefined" &&
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1
  ) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";

  return "unknown";
}

/**
 * Best-effort phone / tablet guess for Order Manager device lists.
 * @returns {"phone"|"tablet"|"unknown"}
 */
export function getDeviceFormFactor() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "unknown";
  }

  const ua = navigator.userAgent || "";
  const os = getOrderManagerOs();

  if (os === "ios") {
    if (
      /iPad/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    ) {
      return "tablet";
    }
    if (/iPhone|iPod/i.test(ua)) return "phone";
    // Capacitor iOS builds are usually tablets for OM.
    return "tablet";
  }

  if (os === "android") {
    if (/Mobile/i.test(ua) && !/Tablet|Pad/i.test(ua)) return "phone";
    return "tablet";
  }

  if (/iPhone|iPod|Android.*Mobile|Mobi/i.test(ua)) return "phone";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  return "unknown";
}

/**
 * Short label stored on OM sessions, e.g. "Android tablet", "iOS phone".
 */
export function getOrderManagerDeviceLabel() {
  const os = getOrderManagerOs();
  const formFactor = getDeviceFormFactor();

  if (os === "ios") {
    return formFactor === "phone" ? "iOS phone" : "iOS tablet";
  }
  if (os === "android") {
    return formFactor === "phone" ? "Android phone" : "Android tablet";
  }
  return "Unknown device";
}
