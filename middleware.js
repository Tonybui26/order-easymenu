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

  // Check if token has required user data
  if (!token.menuLink) {
    console.log("Invalid token data, forcing signout and redirect to signin");

    // Create redirect response directly to signin
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    signInUrl.searchParams.set("error", "InvalidToken"); // Optional: show error message
    const response = NextResponse.redirect(signInUrl);

    // Clear all NextAuth cookies to force complete signout
    const cookiesToClear = [
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
      "next-auth.csrf-token",
      "__Host-next-auth.csrf-token",
      "next-auth.callback-url",
      "__Secure-next-auth.callback-url",
    ];

    cookiesToClear.forEach((cookieName) => {
      response.cookies.set(cookieName, "", {
        expires: new Date(0),
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    });

    return response;
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
    "/",
  ],
};
