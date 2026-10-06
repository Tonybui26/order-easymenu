"use server";

import { getServerSession } from "next-auth";
import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";
import { createTokenFromSession } from "@/lib/auth/tokenUtils";
import { getMainAppUrl, readMainAppApiError } from "@/lib/api/mainAppServer";

const MAIN_APP_URL_API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : getMainAppUrl();

export async function fetchBookingsAction({ status, from, to } = {}) {
  const session = await getServerSession(NextAuthOptions);
  if (!session) throw new Error("Not authenticated");

  const params = new URLSearchParams({ status });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const response = await fetch(
    `${MAIN_APP_URL_API}/api/bookings/sessions?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${createTokenFromSession(session)}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await readMainAppApiError(response));
  }

  return response.json();
}

export async function assignBookingTablesAction(bookingId, tables) {
  const session = await getServerSession(NextAuthOptions);
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(
    `${MAIN_APP_URL_API}/api/bookings/sessions/${bookingId}/assign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${createTokenFromSession(session)}`,
      },
      body: JSON.stringify({ tables }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await readMainAppApiError(response));
  }

  return response.json();
}
