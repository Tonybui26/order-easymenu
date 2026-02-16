/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable StrictMode
  env: {
    // Generate build ID at build time
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID || 
      (process.env.NODE_ENV === 'production' 
        ? Date.now().toString() 
        : 'dev' + Math.random().toString(36).substring(2, 15)),
  },
};

export default nextConfig;
