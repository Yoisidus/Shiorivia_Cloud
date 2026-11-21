/**
 * Novel-only chapter state. Unlike Story's <game_state>, this tracks the
 * narrative setting/active event. The legacy nextSceneCastIds field remains
 * readable for existing JSON saves; current cast selection happens separately.
 * The WORLD / ERA / PERIOD is never inferred or overwritten.
 */
export type NovelState = {
  environment: string;
  event: string;
  /** New chapter protocol; old Local JSON chapters may lack these. */
  era?: string;
  period?: string;
  nextSceneCastIds: string[];
  /** Integrated chapter suggestions. Optional when reading legacy Local archives. */
  choices?: { fun: string; rational: string; radical: string };
  /** Integrated optional fictional audience comments. */
  danmaku?: string[];
};

const MAX_FIELD_LENGTH = 2000;
const MAX_CAST_IDS = 6;

export function parseNovelState(value: unknown): NovelState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.environment !== "string" || typeof record.event !== "string"
    || !record.environment.trim() || !record.event.trim()
    || record.environment.length > MAX_FIELD_LENGTH || record.event.length > MAX_FIELD_LENGTH
    || !Array.isArray(record.nextSceneCastIds) || record.nextSceneCastIds.length > 30
    || !record.nextSceneCastIds.every(id => typeof id === "string" && id.length <= 100)) return null;
  const choices = record.choices && typeof record.choices === "object" && !Array.isArray(record.choices)
    ? record.choices as Record<string, unknown> : null;
  const validChoices = choices && (["fun", "rational", "radical"] as const)
    .every(key => typeof choices[key] === "string" && String(choices[key]).trim().length > 0 && String(choices[key]).length <= 600);
  const danmaku = Array.isArray(record.danmaku)
    ? record.danmaku.filter((item): item is string => typeof item === "string").map(s => s.trim().slice(0, 120)).filter(Boolean).slice(0, 24) : [];
  return {
    environment: record.environment.trim(),
    event: record.event.trim(),
    ...(typeof record.era === "string" && record.era.trim().length <= 100 && record.era.trim()
      ? { era: record.era.trim() } : {}),
    ...(typeof record.period === "string" && record.period.trim().length <= 100 && record.period.trim()
      ? { period: record.period.trim() } : {}),
    nextSceneCastIds: [...new Set(record.nextSceneCastIds)].slice(0, MAX_CAST_IDS),
    ...(validChoices ? { choices: {
      fun: String(choices!.fun).trim(), rational: String(choices!.rational).trim(),
      radical: String(choices!.radical).trim(),
    } } : {}),
    danmaku,
  };
}

/** Choose the LAST valid completed state to avoid stale state from a model retry. */
export function extractNovelState(output: string): NovelState | null {
  const expression = /<novel_state\s*>([\s\S]*?)<\/novel_state\s*>/gi;
  let found: NovelState | null = null;
  for (const match of output.matchAll(expression)) {
    try {
      const state = parseNovelState(JSON.parse(match[1]));
      if (state) found = state;
    } catch { /* Ignore malformed JSON, never overwrite established state. */ }
  }
  return found;
}

/** Strip internal protocol from chapters, live previews, summaries and exports. */
export function stripNovelState(output: string): string {
  return output
    .replace(/<novel_state\s*>[\s\S]*?<\/novel_state\s*>/gi, "")
    .replace(/<novel_state\b[^>]*>[\s\S]*$/gi, "")
    .trim();
}
