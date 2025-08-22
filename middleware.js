import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  // Get the token using next-auth
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If no token, redirect to signin
  if (!token) {
    console.log("no token, redirect to signin");
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Add pathname to headers so we can access it in server components
  const response = NextResponse.next();
  response.headers.set("x-pathname", req.nextUrl.pathname);

  return response;
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    // Protected pages that require authentication only
    "/admin/:path*",
    "/me/:path*",
    "/",
  ],
};
