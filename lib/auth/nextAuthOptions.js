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
      },
      async authorize(credentials) {
        // This will call your main app's NextAuth authorize function
        // The actual authentication happens in the main app
        console.log("credentials", credentials);
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_MAIN_APP_URL}/api/auth/order-manager-login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...credentials }),
            },
          );

          if (response.ok) {
            const responseData = await response.json();
            const user = responseData.user;
            console.log("user", user);
            return user;
          }
          return null;
        } catch (error) {
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
        console.log("Populating token with user data:", user);
        token.id = user.id;
        token.username = user.username;
        token.name = user.name;
        token.role = user.role;
        token.menuLink = user.menuLink;
        token.storeName = user.storeName;
        token.ownerEmail = user.ownerEmail;
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
      }
      return session;
    },
  },
};
