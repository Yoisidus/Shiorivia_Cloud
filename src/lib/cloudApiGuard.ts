/**
 * Request origin/body policy for the public Cloud beta API.
 * A best-effort per-instance rate cap is enforced by src/proxy.ts;
 * it is NOT a substitute for a distributed edge firewall.
 */
export type CloudRequestCheck = { status: number; message: string } | null;
export function checkCloudApiRequest(input: {
  method: string;
  path: string;
  requestOrigin: string | null;
  site: string | null;
  currentOrigin: string;
  length: string | null;
}): CloudRequestCheck {
  const { method, path, requestOrigin, site, currentOrigin, length } = input;
  if (!path.startsWith("/api/")) return null;
  if (method === "OPTIONS") return { status: 405, message: "CORS preflight is not enabled." };
  if (method !== "POST" && method !== "PUT" && method !== "PATCH" && method !== "DELETE") return null;
  // The Cloud browser client is same-origin only. Third-party browser forms
  // and scripts must never be able to relay private BYOK requests.
  if (site === "cross-site" || (requestOrigin !== null && requestOrigin !== currentOrigin)) {
    return { status: 403, message: "Cross-origin Cloud API requests are forbidden." };
  }
  if (requestOrigin === null && site !== "same-origin") {
    return { status: 403, message: "A same-origin browser request is required." };
  }
  const limit = path === "/api/chat" ? 2 * 1024 * 1024
    : path === "/api/summarize" ? 256 * 1024
    : path === "/api/draw" ? 128 * 1024 : 128 * 1024;
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    return { status: 413, message: "Request body exceeds the Cloud limit." };
  }
  return null;
}
