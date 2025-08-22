import CredentialsProvider from "next-auth/providers/credentials";

export const NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET, // Same secret as main app
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        menuLink: { label: "Menu Link", type: "text" },
      },
      async authorize(credentials) {
        // This will call your main app's NextAuth authorize function
        // The actual authentication happens in the main app
        try {
          const response = await fetch(`${process.env.MAIN_APP_URL}/api/auth/callback/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
          });

          if (response.ok) {
            const user = await response.json();
            return user;
          }
          return null;
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.userType = user.userType;
        
        if (user.userType === "staff") {
          token.role = user.role;
          token.menuLink = user.menuLink;
          token.storeName = user.storeName;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.userType = token.userType;
        
        if (token.userType === "staff") {
          session.user.role = token.role;
          session.user.menuLink = token.menuLink;
          session.user.storeName = token.storeName;
        }
      }
      return session;
    },
  },
};