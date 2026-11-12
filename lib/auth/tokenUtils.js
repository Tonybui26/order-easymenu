import jwt from "jsonwebtoken";

export function createTokenFromSession(session) {
  // Create JWT token with same structure as your main app expects
  return jwt.sign(
    {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      username: session.user.username,
      role: session.user.role,
      menuLink: session.user.menuLink,
      storeName: session.user.storeName,
      ownerEmail: session.user.ownerEmail,
      sessionId: session.user.sessionId,
      isSupport: session.user.isSupport === true,
      userType: session.user.isSupport === true ? "support" : "staff",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    },
    process.env.NEXTAUTH_SECRET,
  );
}
