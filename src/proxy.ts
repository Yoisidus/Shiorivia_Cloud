import { NextResponse, type NextRequest } from "next/server";
import { checkCloudApiRequest } from "./lib/cloudApiGuard";

/**
 * Cloud public beta: the global 503 circuit breaker is removed.
 * Keep same-origin API controls, basic rate caps and defensive headers.
 * Browser project files and credentials are never served from this proxy.
 */
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 5_000;
const buckets = new Map<string, { start: number; count: number }>();

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  const check = checkCloudApiRequest({
    method: request.method, path: pathname,
    requestOrigin: request.headers.get("origin"),
    site: request.headers.get("sec-fetch-site"),
    currentOrigin: request.nextUrl.origin,
    length: request.headers.get("content-length"),
  });
  if (check) {
    return new NextResponse(check.message, {
      status: check.status,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (isApi && request.method !== "GET" && request.method !== "HEAD") {
    // Best-effort isolation for a small public beta. Multiple Vercel instances
    // have separate maps, so distributed rate limits remain a later hardening task.
    const id = request.headers.get("x-real-ip")
      || request.headers.get("x-vercel-forwarded-for")
      || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim()
      || "unknown";
    const key = id + ":" + pathname;
    const now = Date.now();
    if (buckets.size > MAX_BUCKETS) buckets.clear();
    let state = buckets.get(key);
    if (!state || now - state.start > WINDOW_MS) state = { start: now, count: 0 };
    state.count++;
    buckets.set(key, state);
    if (state.count > (pathname === "/api/chat" ? 45 : 75)) {
      return new NextResponse("Cloud request limit reached. Retry shortly.", {
        status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      });
    }
  }
  const response = NextResponse.next();
  if (isApi) response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
