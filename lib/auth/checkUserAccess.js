import connectMongoDB from "@/libs/mongodb";
import User from "@/models/user";

export async function checkUserAccess(email) {
  if (!email) {
    console.error("Email is required for access check");
    return { hasAccess: false, user: null };
  }

  try {
    await connectMongoDB();
    const user = await User.findOne({ email }).lean(); // Use lean() for better performance

    if (!user) {
      console.log(`User not found: ${email}`);
      return { hasAccess: false, user: null };
    }

    return {
      hasAccess: Boolean(user.hasAccess),
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        plan: user.plan || "basic",
        customerId: user.customerId,
        hasAccess: Boolean(user.hasAccess),
      },
    };
  } catch (error) {
    console.error("Error checking user access:", error);
    return { hasAccess: false, user: null };
  }
}
