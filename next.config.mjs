/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable StrictMode
  images: {
    domains: [
      "mecook-beta.s3.us-east-2.amazonaws.com",
      "goeasymenu.s3.us-east-2.amazonaws.com",
      "img.cdn4dd.com", // for Doordash
      "tb-static.uber.com", // for Uber Eats
      "d1ralsognjng37.cloudfront.net", // for Uber Eats
    ], // Add the allowed external domain here
  },
  env: {
    // Generate build ID at build time
    NEXT_PUBLIC_BUILD_ID:
      process.env.NEXT_PUBLIC_BUILD_ID ||
      (process.env.NODE_ENV === "production"
        ? Date.now().toString()
        : "dev" + Math.random().toString(36).substring(2, 15)),
  },
};

export default nextConfig;
