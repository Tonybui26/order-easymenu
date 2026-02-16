// Server start timestamp fallback (set when module first loads)
let serverStartTimestamp = Date.now().toString();

function getBuildId() {
  // Prefer NEXT_PUBLIC_BUILD_ID
  if (process.env.NEXT_PUBLIC_BUILD_ID) {
    console.log("NEXT_PUBLIC_BUILD_ID", process.env.NEXT_PUBLIC_BUILD_ID);
    return process.env.NEXT_PUBLIC_BUILD_ID;
  }
  
  // Fallback to VERCEL_GIT_COMMIT_SHA
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    console.log("VERCEL_GIT_COMMIT_SHA", process.env.VERCEL_GIT_COMMIT_SHA);
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }
  
  // Final fallback: server start timestamp
  console.log("serverStartTimestamp", serverStartTimestamp);
  return serverStartTimestamp;
}

export async function GET() {
  const buildId = getBuildId();
  console.log("buildId", buildId);
  return Response.json(
    { buildId },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

