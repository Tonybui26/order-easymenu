// Authentication configuration constants
export const AUTH_CONFIG = {
  // Default redirect URL after successful authentication
  DEFAULT_REDIRECT_URL: "/",

  /** Home when POS is enabled for the store. */
  POS_HOME_URL: "/pos",

  // Dashboard URL (can be different from default redirect)
  DASHBOARD_URL: "/me/dashboard",

  // Other auth-related constants
  SESSION_MAX_AGE: 30 * 24 * 60 * 60, // 30 days in seconds
  PASSWORD_MIN_LENGTH: 6,

  // Sign in/up page paths
  SIGNIN_PATH: "/signin",
  SIGNUP_PATH: "/signup",

  // Callback URL parameter name
  CALLBACK_URL_PARAM: "callbackUrl",
};

/**
 * Post-login / post-PIN home.
 * Explicit callback URLs (other than "/") are respected; otherwise POS stores
 * go to /pos and everyone else to live orders (/).
 * @param {string|null} [callbackUrl]
 * @param {boolean} [posEnabled]
 */
export function getAuthRedirectUrl(callbackUrl = null, posEnabled = false) {
  const callback = typeof callbackUrl === "string" ? callbackUrl.trim() : "";
  if (callback && callback !== "/") return callback;
  return posEnabled ? AUTH_CONFIG.POS_HOME_URL : AUTH_CONFIG.DEFAULT_REDIRECT_URL;
}

// Helper function to get dashboard URL
export function getDashboardUrl() {
  return AUTH_CONFIG.DASHBOARD_URL;
}
