import { isIP } from "node:net";
import { DEFAULT_LOCAL_PROVIDERS, type LocalProviderId, type PublicLocalProvider } from "./localProviders";
import type { CloudCredential } from "./cloudCredentials";

export type ServerCloudProvider = PublicLocalProvider & { apiKey: string; baseURL: string };

/** Prevent obvious local/metadata network targeting in custom URLs.
 * Custom server-side proxying is disabled until a DNS pinning / SSRF review.
 */
function validateCloudBaseURL(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host=u.hostname.toLowerCase();
    if (u.protocol!=="https:" || u.username || u.password || u.hash || u.search ||
        u.port || isIP(host)!==0 || !host.includes(".") || host==="localhost" ||
        /(?:^|\.)(?:localhost|local|internal|test|invalid|example|home|lan)$/.test(host) ||
        /^169\.254\./.test(host))return null;
    return u.toString().replace(/\/$/,"");
  } catch {return null;}
}
const customIds=["custom_1","custom_2","custom_3","custom_4"];
export function getServerLocalProvider(id:unknown,raw?:unknown):ServerCloudProvider|null {
  if (typeof id!=="string" || typeof raw!=="object" || raw===null || Array.isArray(raw))return null;
  const item=raw as Record<string,unknown>;
  const apiKey=typeof item.apiKey==="string"?item.apiKey.trim():"";
  if (!apiKey || apiKey.length>400 || /[\r\n\0]/.test(apiKey))return null;
  const builtin=DEFAULT_LOCAL_PROVIDERS.find(p=>p.id===id);
  if (builtin) {
    const baseURL=id==="deepseek"?"https://api.deepseek.com":id==="openrouter"?"https://openrouter.ai/api/v1":"";
    return {...builtin,configured:true,apiKey,baseURL};
  }
  if (!customIds.includes(id) || process.env.CLOUD_CUSTOM_ENDPOINTS_ENABLED!=="true")return null;
  const baseURL=validateCloudBaseURL(typeof item.baseURL==="string"?item.baseURL:"");
  if (!baseURL)return null;
  return {id:id as LocalProviderId,label:id,custom:true,configured:true,apiKey,baseURL};
}

/** No server-side secret or configured provider list is exposed in Cloud. */
export function publicLocalProviders(): PublicLocalProvider[] {
  return [
    ...customIds.map(id=>({id:id as LocalProviderId,label:id,custom:true,configured:false})),
    ...DEFAULT_LOCAL_PROVIDERS,
  ];
}
