/**
 * Gets the base URL for API requests, works in both client and server environments
 * @returns {string} The base URL
 */
export function getBaseUrl() {
  // Check if we're in a browser environment
  if (typeof window !== "undefined") {
    // Client-side: use the current origin
    return window.location.origin;
  }

  // Then try NEXT_PUBLIC_BASE_URL which you can set in your .env file
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Fallback to localhost for development
  return "http://localhost:3000";
}

/**
 * Create a new user (signup)
 * @param {Object} userData - User data to register with
 * @param {string} userData.email - User's email
 * @param {string} userData.password - User's password
 * @param {string} [userData.name] - User's name (optional)
 * @param {string} [userData.timezone] - User's timezone (optional)
 * @returns {Promise<Object>} The response data
 */
export async function createUser(userData) {
  try {
    const response = await fetch(`${getBaseUrl()}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    return {
      status: response.status,
      data,
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      status: 500,
      data: { message: "An unexpected error occurred" },
    };
  }
}

export async function fetchGetUser(email) {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/user/get/${email}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorDetails = await res.json();
    if (res.status === 404) {
      return null;
    }
    throw new Error(`${errorDetails.message || res.statusText}`);
  }
  const { user } = await res.json();
  return user;
}
