import { advanceWorldlineFromState, timelineStageDescription, type StoryWorldline } from "./storyWorldline";

/** Optional private chronology proposal for Umbra/VIAE. Story/Tela already
 * have era/period/event inside their existing game_state/novel_state objects. */
export function worldlineAdvanceInstruction(worldline: StoryWorldline, locale: string): string {
  if (worldline.kind !== "canon") return "";
  const stages = worldline.canonTimeline.map((stage, index) => ({
    index, era: stage.era, period: stage.period,
    ...(timelineStageDescription(stage, locale) ? { description: timelineStageDescription(stage, locale) } : {}),
  }));
  return `
[OPTIONAL WORLDLINE ADVANCEMENT — PRIVATE METADATA]
Current: ${JSON.stringify({ era: worldline.era, period: worldline.period })}.
Ordered valid stages (earliest to latest): ${JSON.stringify(stages)}.
Continue normal conversation / VIAE chat formatting. ONLY if this response definitively moves the actual in-world story to a LATER stage, append ONE private marker AFTER the required <turn_memory> block, as the FINAL output block:
<worldline_update>{"era":"exact later ERA","period":"exact later PERIOD"}</worldline_update>
If the time stays the same, OMIT the marker entirely. When a <turn_memory> block is required, place worldline_update AFTER turn_memory, never before it. Never use this tag to report a character's memories, retrospective mentions, proposed future visits or speculation. Never rewind; never alter WORLD, AU baselines or other worlds. The client validates the request and ignores illegal changes. The tag is not conversational content and should not be repeated in quoted speech.
[END OPTIONAL WORLDLINE ADVANCEMENT]
`;
}

export function extractWorldlineAdvance(text: string): { era: string; period: string } | null {
  const chunks = [...text.matchAll(/<worldline_update\s*>([\s\S]*?)<\/worldline_update\s*>/gi)];
  if (!chunks.length) return null;
  try {
    const obj: unknown = JSON.parse(chunks[chunks.length - 1][1]);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const era = (obj as { era?: unknown }).era;
    const period = (obj as { period?: unknown }).period;
    if (typeof era !== "string" || typeof period !== "string"
        || !era.trim() || !period.trim() || era.length > 100 || period.length > 100) return null;
    return { era: era.trim(), period: period.trim() };
  } catch { return null; }
}

export function stripWorldlineAdvance(text: string): string {
  return String(text || "")
    .replace(/<worldline_update\s*>[\s\S]*?<\/worldline_update\s*>\s*/gi, "")
    .replace(/<worldline_update\b[\s\S]*$/i, "")
    .trimEnd();
}

export function applyWorldlineAdvance(
  worldline: StoryWorldline | null | undefined,
  text: string,
): StoryWorldline | null {
  if (!worldline) return null;
  const candidate = extractWorldlineAdvance(text);
  return candidate ? advanceWorldlineFromState(worldline, candidate) : null;
}
