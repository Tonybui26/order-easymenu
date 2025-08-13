import { getServerSession } from "next-auth";
import { NextAuthOptions } from "./nextAuthOptions";

export const getServerUserSession = async () => {
  const session = await getServerSession(NextAuthOptions);
  // if no session, return null
  if (!session) {
    return null;
  }
  return session?.user;
};
