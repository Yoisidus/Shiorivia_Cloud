import { TIMELINE_LOCALES, type TimelineLocale, type ChartaWorld, type ChartaTimelineStage } from "./chartaWorld";
import { deepText } from "./i18nDeep";

export const BANG_DREAM_WORLD_ID = "bang-dream";
export const BANG_DREAM_WORLD_NAME = "BanG Dream!";

/** Built-in timeline IDs are stored, while their descriptions reuse existing i18nDeep translations. */
const BUILT_IN_PERIODS = [
  ["早年", "T-0-1"], ["初三春夏季", "T-1-2"], ["初三、毕业后的暑假", "T-2-3"],
  ["高一秋冬季", "T-3-4"], ["高一秋冬季", "T-4-5"], ["高一春夏季", "T-5-6"],
  ["高一春夏季", "T-6-7"], ["高一春夏季", "T-7-8"], ["高一春夏季", "T-8-9"],
  ["未来", "T-9-10"],
] as const;
export const BANG_DREAM_CANON: ChartaTimelineStage[] = BUILT_IN_PERIODS.map(([era, period]) => ({
  era, period,
  descriptions: Object.fromEntries(TIMELINE_LOCALES.map(locale => [
    locale, deepText(locale, `timeline.${period.slice(2)}` as import("./i18nDeep").DeepTextKey),
  ])) as Partial<Record<TimelineLocale, string>>,
}));

/** Show a timeline description only in the exact selected language. Never fall back. */
export function timelineStageDescription(stage: ChartaTimelineStage | undefined, locale: string): string {
  if (!stage || !TIMELINE_LOCALES.some(value => value === locale)) return "";
  return stage.descriptions?.[locale as TimelineLocale]?.trim() || "";
}

/** Localize built-in BanG Dream! era labels without changing saved timeline IDs. */
const BANG_DREAM_ERA_LABELS: Record<string, Record<string, string>> = {
  "早年": { "zh-CN": "早年", "zh-TW": "早年", en: "Early years", ja: "幼少期", ko: "어린 시절" },
  "初三春夏季": { "zh-CN": "初三春夏季", "zh-TW": "國三春夏", en: "Final middle-school year · spring/summer", ja: "中学3年 · 春夏", ko: "중학교 3학년 · 봄/여름" },
  "初三、毕业后的暑假": { "zh-CN": "初三、毕业后的暑假", "zh-TW": "國中畢業後的暑假", en: "Summer after middle-school graduation", ja: "中学卒業後の夏休み", ko: "중학교 졸업 후 여름방학" },
  "高一秋冬季": { "zh-CN": "高一秋冬季", "zh-TW": "高一秋冬", en: "First high-school year · autumn/winter", ja: "高校1年 · 秋冬", ko: "고등학교 1학년 · 가을/겨울" },
  "高一春夏季": { "zh-CN": "高一春夏季", "zh-TW": "高一春夏", en: "First high-school year · spring/summer", ja: "高校1年 · 春夏", ko: "고등학교 1학년 · 봄/여름" },
  "未来": { "zh-CN": "未来", "zh-TW": "未來", en: "Future", ja: "未来", ko: "미래" },
};
export function displayWorldlineEra(worldId: string, era: string, locale: string): string {
  return worldId === BANG_DREAM_WORLD_ID ? BANG_DREAM_ERA_LABELS[era]?.[locale] || era : era;
}

/** The archive order, not the T-x-y number or era spelling, defines progression. */
export function worldlineStageIndex(worldline: Pick<StoryWorldline, "kind" | "canonTimeline" | "era" | "period">): number {
  return worldline.canonTimeline.findIndex(stage => stage.era === worldline.era && stage.period === worldline.period);
}

/** Validate a forward-only progression on the original (canon) timeline. AU freeform
 * dates are not forcibly compared; any AU era/period edits need an explicit
 * model/user direction instead of guessing order from arbitrary strings. */
export function canAdvanceWorldline(previous: StoryWorldline, next: StoryWorldline): boolean {
  if (previous.kind !== next.kind) return false;
  if (previous.era === next.era && previous.period === next.period) return true;
  if (previous.kind !== "canon") return false;
  const from = worldlineStageIndex(previous), to = worldlineStageIndex(next);
  return from >= 0 && to >= from;
}


export type SecondaryStoryWorld = {
  worldId: string;
  worldName: string;
  worldDescription: string;
  canonTimeline: ChartaTimelineStage[];
  baseEra: string;
  basePeriod: string;
};
export type StoryCrossWorld = {
  enabled: boolean;
  includeUniversal: boolean;
  /** Up to three separately chosen worlds, each with its own canonical knowledge cutoff. */
  secondary: SecondaryStoryWorld[];
};

export type StoryWorldline = {
  worldId: string;
  worldName: string;
  worldDescription: string;
  canonTimeline: ChartaTimelineStage[];
  kind: "canon" | "au";
  /** AU-only required reference into the selected world\x27s canonical stages. */
  baseEra?: string;
  basePeriod?: string;
  era: string;
  period: string;
  event: string;
  crossWorld?: StoryCrossWorld;
};

export const worldlineFor = (world: ChartaWorld | null): StoryWorldline => ({
  worldId: world?.id || BANG_DREAM_WORLD_ID,
  worldName: world?.name || BANG_DREAM_WORLD_NAME,
  worldDescription: world?.description || "",
  canonTimeline: world?.canonTimeline || BANG_DREAM_CANON,
  kind: "canon", era: "", period: "", event: "",
});

function sanitizeTimelineDescriptions(value: unknown): Partial<Record<TimelineLocale, string>> | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const descriptions: Partial<Record<TimelineLocale, string>> = {};
  for (const locale of TIMELINE_LOCALES) {
    const text = (value as Record<string, unknown>)[locale];
    if (typeof text === "string" && text.trim() && text.length <= 500) descriptions[locale] = text.trim();
  }
  return Object.keys(descriptions).length ? descriptions : null;
}

/** Validate a snapshot from a save or request; never trust client-supplied world data blindly. */
export function parseStoryWorldline(input: unknown): StoryWorldline | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (typeof value.worldId !== "string" || !/^(?:bang-dream|world-[a-zA-Z0-9-]{8,90})$/.test(value.worldId)) return null;
  const text = (field: string, max = 100) => typeof value[field] === "string" && (value[field] as string).length <= max
    ? (value[field] as string).trim() : null;
  const worldName = text("worldName"); const worldDescription = text("worldDescription", 20000);
  const era = text("era"); const period = text("period"); const event = text("event", 500);
  if (!worldName || worldDescription === null || !era || !period || event === null) return null;
  const kind = value.kind === "au" ? "au" : value.kind === "canon" ? "canon" : null;
  if (!kind) return null;
  const rawStages = value.worldId === BANG_DREAM_WORLD_ID ? BANG_DREAM_CANON : value.canonTimeline;
  if (!Array.isArray(rawStages) || rawStages.length > 80) return null;
  const stages: ChartaTimelineStage[] = [];
  for (const stage of rawStages) {
    if (!stage || typeof stage !== "object" || typeof stage.era !== "string" || typeof stage.period !== "string"
      || stage.era.length > 100 || stage.period.length > 100 || !stage.era.trim() || !stage.period.trim()) return null;
      const descriptions = sanitizeTimelineDescriptions(stage.descriptions);
      stages.push({ era: stage.era.trim(), period: stage.period.trim(), ...(descriptions ? { descriptions } : {}) });
  }
  if (kind === "canon" && !stages.some(stage => stage.era === era && stage.period === period)) return null;
  // For AU, the story's creative ERA/PERIOD remains free-form, while the
  // baseline MUST reference an actual canonical period of this world.
  // Legacy AU saves without a baseline remain readable if their old period
  // happens to match a canonical period; otherwise they require reselection.
  const baseEra = text("baseEra");
  const basePeriod = text("basePeriod");
  const legacyBase = stages.find(stage => stage.period === period);
  const reference = kind === "au"
    ? stages.find(stage => stage.period === (basePeriod || legacyBase?.period)
        && stage.era === (baseEra || legacyBase?.era))
    : undefined;
  if (kind === "au" && !reference) return null;
  const rawCross = value.crossWorld;
  const crossWorld: StoryCrossWorld = { enabled: false, includeUniversal: false, secondary: [] };
  if (rawCross !== undefined) {
    if (!rawCross || typeof rawCross !== "object" || Array.isArray(rawCross)) return null;
    const config = rawCross as Record<string, unknown>;
    if (typeof config.enabled !== "boolean" || typeof config.includeUniversal !== "boolean"
        || !Array.isArray(config.secondary) || config.secondary.length > 3) return null;
    crossWorld.enabled = config.enabled;
    crossWorld.includeUniversal = config.enabled && config.includeUniversal;
    const seen = new Set<string>([value.worldId]);
    for (const raw of config.secondary) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const item = raw as Record<string, unknown>;
      if (typeof item.worldId !== "string" || !/^(?:bang-dream|world-[a-zA-Z0-9-]{8,90})$/.test(item.worldId)
        || seen.has(item.worldId) || typeof item.worldName !== "string" || !item.worldName.trim()
        || item.worldName.length > 100 || typeof item.worldDescription !== "string" || item.worldDescription.length > 20000
        || !Array.isArray(item.canonTimeline) || item.canonTimeline.length > 80
        || typeof item.baseEra !== "string" || typeof item.basePeriod !== "string") return null;
      const timeline: ChartaTimelineStage[] = [];
      for (const t of item.canonTimeline) {
        if (!t || typeof t !== "object" || typeof t.era !== "string" || typeof t.period !== "string"
          || !t.era.trim() || !t.period.trim() || t.era.length > 100 || t.period.length > 100) return null;
      const descriptions = sanitizeTimelineDescriptions(t.descriptions);
      timeline.push({ era: t.era.trim(), period: t.period.trim(), ...(descriptions ? { descriptions } : {}) });
      }
      if (!timeline.some(t => t.era === item.baseEra && t.period === item.basePeriod)) return null;
      seen.add(item.worldId);
      crossWorld.secondary.push({ worldId: item.worldId, worldName: item.worldName.trim(),
        worldDescription: item.worldDescription, canonTimeline: timeline,
        baseEra: item.baseEra, basePeriod: item.basePeriod });
    }
  }
  return {
    worldId: value.worldId, worldName, worldDescription, canonTimeline: stages,
    kind, era, period, event, crossWorld,
    ...(kind === "au" ? { baseEra: reference!.era, basePeriod: reference!.period } : {}),
  };
}

/**
 * Apply only validated canon chronology (same stage or later). A malformed,
 * unknown or backward proposal never overwrites persisted time. The model is
 * allowed to describe the scene event independently of a date jump.
 *
 * For AU, a free-form "era" or "period" has no sortable order, so these
 * fields remain anchored until an explicit future ordering system exists.
 */
export function advanceWorldlineFromState(
  previous: StoryWorldline,
  proposed: { era?: unknown; period?: unknown; event?: unknown } | null | undefined,
): StoryWorldline {
  if (!proposed) return previous;
  const nextEvent = typeof proposed.event === "string" && proposed.event.trim()
    ? proposed.event.trim().slice(0, 500) : previous.event;
  const era = typeof proposed.era === "string" && proposed.era.trim() ? proposed.era.trim() : previous.era;
  const period = typeof proposed.period === "string" && proposed.period.trim() ? proposed.period.trim() : previous.period;
  const next = { ...previous, era, period, event: nextEvent };
  // Canon progression uses its timeline ordering. AU changes are not
  // auto-applied because free-form text cannot prove chronological order.
  return canAdvanceWorldline(previous, next) ? next : { ...previous, event: nextEvent };
}

/** World availability and lore cutoffs are shared by Via Lata, Tela and VIAE. */
export function enabledWorldIds(worldline: StoryWorldline): string[] {
  return [worldline.worldId, ...(worldline.crossWorld?.enabled
    ? worldline.crossWorld.secondary.map(world => world.worldId) : [])];
}

export function worldlinePeriodFor(worldline: StoryWorldline, worldId: string | null): string | null {
  if (worldId === worldline.worldId) return worldline.kind === "au"
    ? worldline.basePeriod || null : worldline.period;
  if (!worldline.crossWorld?.enabled) return null;
  return worldline.crossWorld.secondary.find(item => item.worldId === worldId)?.basePeriod || null;
}

/** An existing legacy timeline is never silently discarded or rewritten. */
export function describeStoryWorldline(value: StoryWorldline, locale?: string): string {
  const stage = value.canonTimeline.find(item => item.era === value.era && item.period === value.period);
  const description = locale ? timelineStageDescription(stage, locale) : "";
  return `${value.worldName} · ${value.kind === "canon" ? "原作" : "AU"} · ${locale ? displayWorldlineEra(value.worldId, value.era, locale) : value.era} / ${value.period}${description ? ` · ${description}` : ""}${value.kind === "au" && value.basePeriod ? ` · 基准：${locale ? displayWorldlineEra(value.worldId, value.baseEra || "", locale) : (value.baseEra || "")} / ${value.basePeriod}` : ""}${value.event ? ` · ${value.event}` : ""}`;
}
