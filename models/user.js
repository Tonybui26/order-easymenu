import mongoose, { Schema } from "mongoose";

// Create Schema: defined what the structure of your data look like

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    subscription: {
      type: String,
      enum: ["none", "pro", "premium"],
      default: "none",
    },
    plan: {
      type: String,
      enum: ["basic", "pro"],
      default: "basic",
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },
    customerId: {
      type: String,
    },
    hasAccess: {
      type: Boolean,
      default: false,
    },
    priceId: {
      type: String,
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters long"],
    },
    createdAt: {
      type: Date,
      immutable: true,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      immutable: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
