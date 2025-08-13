import { NextAuthOptions } from "@/lib/auth/nextAuthOptions";

import NextAuth from "next-auth/next";

const handler = NextAuth(NextAuthOptions);
export { handler as POST, handler as GET };
