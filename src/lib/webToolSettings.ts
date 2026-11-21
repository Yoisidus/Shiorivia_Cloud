/** Browser-persisted web search route. Provider IDs remain unchanged when their labels are renamed. */
export type WebToolConfig = {
  mode: "native" | "model";
  provider: string;
  model: string;
};
export const DEFAULT_WEB_TOOL_CONFIG: WebToolConfig = { mode: "native", provider: "openrouter", model: "" };
export function normalizeWebToolConfig(value: unknown): WebToolConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_WEB_TOOL_CONFIG };
  const config = value as Record<string, unknown>;
  const provider = typeof config.provider === "string" && /^(deepseek|google|openrouter|custom_[1-4])$/.test(config.provider)
    ? config.provider : DEFAULT_WEB_TOOL_CONFIG.provider;
  return {
    mode: config.mode === "model" ? "model" : "native",
    provider,
    model: typeof config.model === "string" ? config.model.slice(0, 160) : "",
  };
}
export function normalizeProviderAliases(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [id, name] of Object.entries(value as Record<string, unknown>)) {
    if (/^custom_[1-4]$/.test(id) && typeof name === "string" && name.trim())
      result[id] = name.trim().slice(0, 40);
  }
  return result;
}
