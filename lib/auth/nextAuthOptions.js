import connectMongoDB from "@/lib/mongodb";
import User from "@/models/user";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { AUTH_CONFIG } from "@/lib/constants/auth";
const clearCookiesSignUp = (cookieStore) => {
  // Delete the cookie and redirect to login page
  // To delete a cookie, set its expiration date in the past
  cookieStore.set("mecookapp_current_page", "", {
    expires: new Date(0),
    path: "/",
  });
  cookieStore.set("mecookapp_claimed_link", "", {
    expires: new Date(0),
    path: "/",
  });
};

export const NextAuthOptions = {
  // To generate a secret, use `openssl rand -base64 32`, it is used to encrypt cookies and required for NextAuth in production
  secret: process.env.NEXTAUTH_SECRET || "DevSecret-Only-Use-In-Development",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        await connectMongoDB();

        // Find user by email
        const user = await User.findOne({ email: credentials.email });

        // If no user found, or no password (which would be the case for social login users)
        if (!user || !user.password) {
          return null;
        }

        // Check password
        const isPasswordMatch = await bcrypt.compare(
          credentials.password,
          user.password,
        );
        console.log(isPasswordMatch);

        if (!isPasswordMatch) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          plan: user.plan,
          customerId: user.customerId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // maxAge: 0, // This will expire all sessions immediately
    // Change back to normal after testing:
    maxAge: AUTH_CONFIG.SESSION_MAX_AGE, // Use configurable session max age
  },
  callbacks: {
    async signIn({ user, account }) {
      try {
        // Only handle Google provider logic here
        if (account.provider === "google") {
          if (!user?.email) {
            throw new Error("Google Profile User missing email");
          }
          await connectMongoDB();
          const userExists = await User.findOne({ email: user.email });
          if (userExists) {
            // Add all necessary user data to the user object
            user.id = userExists._id.toString();
            user.hasAccess = userExists.hasAccess;
            user.plan = userExists.plan;
            user.customerId = userExists.customerId;
            user.name = userExists.name;
            return true;
          }

          const newUser = await User.create({
            email: user.email,
            name: user.name,
            authProvider: account.provider,
          });

          if (!newUser) {
            throw new Error("Failed to create user");
          }
          user.id = newUser._id.toString();
          user.hasAccess = newUser.hasAccess;
          user.plan = newUser.plan;
          user.customerId = newUser.customerId;
          user.name = newUser.name;
          return true;
        }

        // For credentials provider, return true (let the authorize function handle validation)
        if (account.provider === "credentials") {
          return true;
        }

        // For any other provider, return false
        return false;
      } catch (error) {
        console.log("Error:", error);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        // Only store essential user data in token
        console.log("user in jwt", user);
        token.id = user.id;
        token.plan = user.plan;
        token.customerId = user.customerId;
        token.name = user.name;
        // Remove hasAccess from token - we'll check this fresh each time
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.plan = token.plan;
        session.user.customerId = token.customerId;
        session.user.name = token.name || session.user.name;
        // Don't include hasAccess - check it fresh each time
      }
      return session;
    },
  },
};
