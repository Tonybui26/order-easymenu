import mongoose from "mongoose";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Convert names to URL-friendly slugs
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-") // Replace non-alphanumeric characters with hyphens
    .replace(/-+/g, "-") // Remove consecutive hyphens
    .replace(/^-|-$/g, ""); // Remove leading or trailing hyphens
}
// Example
// const restaurantName = "Tony's Deli & Grill";
// const slug = slugify(restaurantName); // Output: "tonys-deli-grill"

// Check Reserved Paths
export function isReservedPath(path) {
  const reservedPaths = [
    "/privacy",
    "/privacy-policy",
    "/admin",
    "/terms",
    "/pricing",
    "/faq",
    "/help",
    "/contact",
    "/about",
    "/login",
    "/signup",
    "/signin",
    "/sign-in",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/not-found",
    "/notfound",
    "/support",
    "/404",
    "/500",
    "/403",
    "/401",
    "/api",
    "/_next",
    "/static",
    "/assets",
    "/js",
    "/css",
    "/img",
    "/home",
    "/dashboard",
    "/settings",
    "/profile",
    "/user",
    "/users",
    "/admin-panel",
    "/blog",
    "/articles",
    "/news",
    "/products",
    "/services",
    "/shop",
    "/search",
    "/explore",
    "/categories",
    "/tags",
    "/my-account",
    "/account",
    "/checkout",
    "/cart",
    "/orders",
    "/order",
    "/access-denied",
    "/order-history",
    "/my-menu",
  ];
  return reservedPaths.includes(path);
}
