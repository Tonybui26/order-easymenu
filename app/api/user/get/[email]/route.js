import connectMongoDB from "@/lib/mongodb";
import User from "@/models/user";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { email } = params;
  try {
    if (connectMongoDB().status !== 1) {
      await connectMongoDB();
    }
    const user = await User.findOne({ email });
    if (user) {
      return NextResponse.json(
        { user, message: "User exists" },
        { status: 200 },
      );
    } else {
      return NextResponse.json(
        { message: "User does not exist" },
        { status: 404 },
      );
    }
  } catch (error) {
    console.error("Error getting user:", error);
    return NextResponse.json(
      { message: error.message || "An error occurred when getting user" },
      { status: 500 },
    );
  }
}
