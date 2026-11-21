/** The selected text model is global across spaces but isolated per provider. */
export type ProviderModelChoice = { id: string; kind: "catalog" | "custom" };
export type ProviderModelSelections = Record<string, ProviderModelChoice>;

const ALLOWED = /^(?:deepseek|google|openrouter|custom_[1-4])$/;

export function parseProviderModelSelections(raw: unknown): ProviderModelSelections {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries: ProviderModelSelections = {};
  for (const [provider, value] of Object.entries(raw)) {
    if (!ALLOWED.test(provider) || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const item = value as Record<string, unknown>;
    if (item.kind !== "catalog" && item.kind !== "custom") continue;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 200) continue;
    // A custom provider has no provider-discovered catalog. Its models are user-entered.
    entries[provider] = { id: item.id.trim(), kind: provider.startsWith("custom_") ? "custom" : item.kind };
  }
  return entries;
}

export function modelSelectionFor(
  selections: ProviderModelSelections, provider: string,
): { selectedModel: string; customModelId: string } {
  const entry = selections[provider];
  return entry?.kind === "catalog"
    ? { selectedModel: entry.id, customModelId: "" }
    : { selectedModel: "", customModelId: entry?.id || "" };
}

export function selectProviderModel(
  selections: ProviderModelSelections, provider: string, kind: ProviderModelChoice["kind"], value: string,
): ProviderModelSelections {
  if (!ALLOWED.test(provider)) return selections;
  const id = value.trim();
  const next = { ...selections };
  if (!id) delete next[provider];
  else if (id.length <= 200) next[provider] = {
    id, kind: provider.startsWith("custom_") ? "custom" : kind,
  };
  return next;
}
