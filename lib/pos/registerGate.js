const AUTH_PUBLIC_PATHS = ["/signin", "/signup"];

/** Paths allowed while the POS register is closed (when posEnabled). */
export function isRegisterGateExempt(pathname) {
  if (!pathname) return false;
  if (AUTH_PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname === "/customer-display") return true;
  if (pathname === "/lock") return true;
  if (pathname === "/") return true;
  if (pathname === "/pos/register") return true;
  if (
    pathname === "/printer-management" ||
    pathname.startsWith("/printer-management/")
  ) {
    return true;
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return true;
  }
  if (pathname === "/tyro-test" || pathname.startsWith("/tyro-test/")) {
    return true;
  }
  return false;
}
