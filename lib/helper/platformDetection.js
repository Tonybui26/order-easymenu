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
