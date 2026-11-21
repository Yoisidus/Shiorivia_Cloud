/**
 * Browser-stored Cloud credentials. Never export these via public provider metadata,
 * console logs, session JSON, or Local project archives.
 * Password input masking is presentation only; IndexedDB is not encrypted storage.
 */
export type CloudCredential = { apiKey: string; baseURL: string };
export type CloudCredentials = Record<string, CloudCredential>;
export const CLOUD_PROVIDERS = ["deepseek","openrouter","google","fal","custom_1","custom_2","custom_3","custom_4"] as const;
export function safeCloudCredentials(raw: unknown): CloudCredentials {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: CloudCredentials = {};
  for (const id of CLOUD_PROVIDERS) {
    const item = (raw as Record<string, any>)[id];
    if (!item || typeof item !== "object") continue;
    const apiKey = typeof item.apiKey === "string" ? item.apiKey.trim().slice(0,400) : "";
    const baseURL = typeof item.baseURL === "string" ? item.baseURL.trim().slice(0,500) : "";
    if (apiKey || baseURL) result[id] = {apiKey,baseURL};
  }
  return result;
}
