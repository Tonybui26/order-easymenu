// Authentication configuration constants
export const AUTH_CONFIG = {
  // Default redirect URL after successful authentication
  DEFAULT_REDIRECT_URL: "/",

  /** Home when POS is enabled for the store. */
  POS_HOME_URL: "/pos",

  /** Home when POS restaurant mode is enabled. */
  POS_TABLE_MAP_URL: "/pos/table-map",

  // Dashboard URL (can be different from default redirect)
  DASHBOARD_URL: "/me/dashboard",

  // Other auth-related constants
  SESSION_MAX_AGE: 30 * 24 * 60 * 60, // 30 days in seconds
  PASSWORD_MIN_LENGTH: 6,

  // Sign in/up page paths
  SIGNIN_PATH: "/signin",
  SIGNUP_PATH: "/signup",
  LOCK_PATH: "/lock",

  // Callback URL parameter name
  CALLBACK_URL_PARAM: "callbackUrl",
};

/**
 * Post-login / post-PIN home.
 * Explicit callback URLs (other than "/") are respected; otherwise POS stores
 * go to the table map in restaurant mode, /pos otherwise, and everyone else
 * to live orders (/).
 * @param {string|null} [callbackUrl]
 * @param {boolean} [posEnabled]
 * @param {boolean} [restaurantModeEnabled]
 */
export function getAuthRedirectUrl(
  callbackUrl = null,
  posEnabled = false,
  restaurantModeEnabled = false,
) {
  const callback = typeof callbackUrl === "string" ? callbackUrl.trim() : "";
  if (callback && callback !== "/") return callback;
  if (!posEnabled) return AUTH_CONFIG.DEFAULT_REDIRECT_URL;
  if (restaurantModeEnabled) return AUTH_CONFIG.POS_TABLE_MAP_URL;
  return AUTH_CONFIG.POS_HOME_URL;
}

/**
 * Entry URL after credential sign-in. PIN-lock stores go to /lock first;
 * unlock then continues to {@link getAuthRedirectUrl}.
 * @param {string|null} [callbackUrl]
 * @param {boolean} [posEnabled]
 * @param {boolean} [restaurantModeEnabled]
 * @param {boolean} [pinLockEnabled]
 */
export function getPostSignInUrl(
  callbackUrl = null,
  posEnabled = false,
  restaurantModeEnabled = false,
  pinLockEnabled = false,
) {
  const home = getAuthRedirectUrl(
    callbackUrl,
    posEnabled,
    restaurantModeEnabled,
  );
  if (!pinLockEnabled) return home;
  const params = new URLSearchParams();
  if (home && home !== "/") params.set(AUTH_CONFIG.CALLBACK_URL_PARAM, home);
  const query = params.toString();
  return query
    ? `${AUTH_CONFIG.LOCK_PATH}?${query}`
    : AUTH_CONFIG.LOCK_PATH;
}

// Helper function to get dashboard URL
export function getDashboardUrl() {
  return AUTH_CONFIG.DASHBOARD_URL;
}
