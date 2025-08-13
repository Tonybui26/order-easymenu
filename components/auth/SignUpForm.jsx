"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { createUser } from "@/lib/api/fetchApi";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AUTH_CONFIG } from "@/lib/constants/auth";

export default function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [timezone, setTimezone] = useState("");
  const router = useRouter();

  // Detect user's timezone on component mount
  useEffect(() => {
    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(detectedTimezone);
    } catch (error) {
      console.error("Error detecting timezone:", error);
      setTimezone("UTC"); // Fallback to UTC
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Simple client-side validation
    if (password.length < AUTH_CONFIG.PASSWORD_MIN_LENGTH) {
      setError(
        `Password must be at least ${AUTH_CONFIG.PASSWORD_MIN_LENGTH} characters long`,
      );
      setIsLoading(false);
      return;
    }

    try {
      const userData = {
        name,
        email,
        password,
        timezone, // Include timezone in the user data
      };

      const response = await createUser(userData);

      if (response.status === 201) {
        // Registration successful, now automatically sign in the user
        const signInResult = await signIn("credentials", {
          redirect: false,
          email,
          password,
        });

        if (signInResult?.error) {
          setError(
            "Registration successful but failed to sign in. Please try signing in manually.",
          );
          setIsLoading(false);
          return;
        }

        if (signInResult?.ok) {
          // Successfully signed in, redirect to configured URL
          router.push(AUTH_CONFIG.DEFAULT_REDIRECT_URL);
          router.refresh();
        }
      } else {
        // Server returned an error
        setError(
          response.data.message ||
            "Failed to create account. Please try again.",
        );
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Signup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle
                className="h-5 w-5 text-red-400"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Your Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
            className="focus:border-primary focus:ring-primary mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="focus:border-primary focus:ring-primary mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus:border-primary focus:ring-primary block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:outline-none"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Must be at least {AUTH_CONFIG.PASSWORD_MIN_LENGTH} characters
          </p>
        </div>

        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="terms" className="text-gray-700">
              I agree to the{" "}
              <Link
                href="/terms"
                className="text-primary hover:text-primary/80 font-medium"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy-policy"
                className="text-primary hover:text-primary/80 font-medium"
              >
                Privacy Policy
              </Link>
            </label>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-primary hover:bg-primary/80 focus:ring-primary group relative flex w-full justify-center rounded-lg px-4 py-3 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70"
          >
            {isLoading ? (
              <svg
                className="h-5 w-5 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              "Create account"
            )}
          </button>
          <p className="mt-2 text-center text-sm text-gray-600">
            Have an account?{" "}
            <Link
              href="/signin"
              className="text-primary hover:text-primary/80 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </>
  );
}
