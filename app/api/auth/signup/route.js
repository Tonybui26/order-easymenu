import connectMongoDB from "@/lib/mongodb";
import User from "@/models/user";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/constants/auth";

export async function POST(request) {
  // Parse request body
  const { email, password, name, timezone } = await request.json();
  try {
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 },
      );
    }

    // Validate password length
    if (password.length < AUTH_CONFIG.PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        {
          message: `Password must be at least ${AUTH_CONFIG.PASSWORD_MIN_LENGTH} characters long`,
        },
        { status: 400 },
      );
    }

    // Connect to MongoDB
    await connectMongoDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await User.create({
      email,
      password: hashedPassword,
      name: name || email.split("@")[0], // Use part of email as name if not provided
      authProvider: "local",
      // timezone: timezone || "UTC", // Use provided timezone or default to UTC
    });

    // Return success response (omitting the password)
    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          // timezone: user.timezone,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { message: "Error creating user", error: error.message },
      { status: 500 },
    );
  }
}
