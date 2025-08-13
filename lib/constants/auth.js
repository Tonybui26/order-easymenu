// Authentication configuration constants
export const AUTH_CONFIG = {
  // Default redirect URL after successful authentication
  DEFAULT_REDIRECT_URL: "/me/dashboard",

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

// Helper function to get redirect URL with fallback
export function getAuthRedirectUrl(callbackUrl = null) {
  return callbackUrl || AUTH_CONFIG.DEFAULT_REDIRECT_URL;
}

// Helper function to get dashboard URL
export function getDashboardUrl() {
  return AUTH_CONFIG.DASHBOARD_URL;
}
