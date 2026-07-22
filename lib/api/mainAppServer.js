/** Base URL for server-side calls from Order Manager → easymenu API. */
export function getMainAppUrl() {
  return (
    process.env.MAIN_APP_URL ||
    process.env.NEXT_PUBLIC_MAIN_APP_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://goeasy.menu")
  );
}

export async function readMainAppApiError(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data.error || data.message || `Request failed (${response.status})`;
  } catch {
    if (response.status === 404) {
      return "Refund API not found on the main app. Deploy the latest easymenu release with order-app refund routes.";
    }
    return `Main app request failed (${response.status})`;
  }
}
