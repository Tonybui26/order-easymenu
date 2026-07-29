/**
 * Same-origin proxy for store logo images so canvas can read pixels
 * without depending on S3/CDN CORS headers.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(request) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return new Response("Missing url", { status: 400 });
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    return new Response("Unsupported protocol", { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { Accept: "image/*,*/*" },
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return new Response(`Upstream image failed: ${upstream.status}`, {
        status: 502,
      });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new Response("URL is not an image", { status: 400 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return new Response("Image too large", { status: 413 });
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[proxy-image]", error);
    return new Response("Failed to fetch image", { status: 502 });
  }
}
