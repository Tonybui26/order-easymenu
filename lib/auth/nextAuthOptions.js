import CredentialsProvider from "next-auth/providers/credentials";

export const NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET, // Same secret as main app
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        menuLink: { label: "Menu Link", type: "text" },
        deviceLabel: { label: "Device", type: "text" },
        force: { label: "Force", type: "text" },
        revokeSessionIds: { label: "Revoke sessions", type: "text" },
      },
      async authorize(credentials) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_MAIN_APP_URL}/api/auth/order-manager-login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: credentials?.username,
                password: credentials?.password,
                menuLink: credentials?.menuLink,
                deviceLabel: credentials?.deviceLabel || "",
                force: credentials?.force === "true",
                revokeSessionIds: credentials?.revokeSessionIds || "[]",
              }),
            },
          );

          if (response.ok) {
            const responseData = await response.json();
            const user = responseData.user;
            return user;
          }

          // Surface device-limit conflicts to the sign-in UI via error code.
          if (response.status === 409) {
            const conflict = await response.json().catch(() => null);
            if (conflict?.code === "DEVICE_LIMIT_REACHED") {
              throw new Error(
                `DEVICE_LIMIT_REACHED:${JSON.stringify({
                  maxDevices: conflict.maxDevices,
                  activeDeviceCount: conflict.activeDeviceCount,
                  devicesToRevoke: conflict.devicesToRevoke,
                  devices: conflict.devices || [],
                  message: conflict.message,
                })}`,
              );
            }
          }

          return null;
        } catch (error) {
          if (
            typeof error?.message === "string" &&
            error.message.startsWith("DEVICE_LIMIT_REACHED:")
          ) {
            throw error;
          }
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.name = user.name;
        token.role = user.role;
        token.menuLink = user.menuLink;
        token.storeName = user.storeName;
        token.ownerEmail = user.ownerEmail;
        token.sessionId = user.sessionId;
        token.isSupport = user.isSupport === true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.name = token.name;
        session.user.role = token.role;
        session.user.menuLink = token.menuLink;
        session.user.storeName = token.storeName;
        session.user.ownerEmail = token.ownerEmail;
        session.user.sessionId = token.sessionId;
        session.user.isSupport = token.isSupport === true;
      }
      return session;
    },
  },
};
