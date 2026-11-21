import { CHAR_DATA } from "../data/char_config";
import { LORE_LIBRARY } from "../data/lore_library";
import { formatChartaLore } from "./chartaLore";
import type { chartaWireCharacters } from "./chartaWire";
import { BANG_DREAM_CANON, BANG_DREAM_WORLD_ID, BANG_DREAM_WORLD_NAME, timelineStageDescription } from "./storyWorldline";
import { normalizeLocale } from "./locale";
import type { ChartaTimelineStage } from "./chartaWorld";

export type EngineeringLoreOptions = { relationships: boolean; experiences: boolean };
export type EngineeringWorldInfo = {
  id: string;
  name: string;
  description: string;
  canonTimeline: ChartaTimelineStage[];
};
type WireCharacter = ReturnType<typeof chartaWireCharacters>[number];

export const DEFAULT_ENGINEERING_LORE_OPTIONS: EngineeringLoreOptions = {
  relationships: false, experiences: false,
};

const HEADINGS = [
  "### 【基础身份与称呼】",
  "### 一、主要性格与行为逻辑",
  "### 二、核心人物关系（随时间线动态变化）",
  "### 三、主要经历（按时间线严格对应）",
  "### 四、AI还原角色注意事项（情境化倾向指南）",
] as const;

/** Use the original all-period lore sections, not a canon-time filtered story excerpt. */
export function fullBuiltInEngineeringLore(source: string, options: EngineeringLoreOptions): string {
  if (!source.trim()) return "";
  const positions = HEADINGS.map(heading => source.indexOf(heading));
  if (positions.some((pos, i) => pos < 0 || (i > 0 && pos <= positions[i - 1]))) {
    // Unknown legacy format: preserve available text rather than inventing facts.
    return source.trim();
  }
  return HEADINGS.map((heading, index) => {
    if ((index === 2 && !options.relationships) || (index === 3 && !options.experiences)) return "";
    const start = positions[index];
    const end = positions[index + 1] ?? source.length;
    return source.slice(start, end).trim();
  }).filter(Boolean).join("\n\n");
}

/** Only the chosen engineering persona receives full character/world data. */
export function buildEngineeringCharacterContext(
  characterId: string,
  customCharacters: readonly WireCharacter[],
  customWorlds: readonly EngineeringWorldInfo[],
  options: EngineeringLoreOptions = DEFAULT_ENGINEERING_LORE_OPTIONS,
  uiLanguage: unknown = "zh-CN",
): string {
  const included: EngineeringLoreOptions = {
    relationships: options.relationships === true,
    experiences: options.experiences === true,
  };
  const custom = customCharacters.find(character => character.id === characterId);
  const builtIn = CHAR_DATA.find(character => character.id === characterId);
  const character = custom || builtIn;
  if (!character) return "[OFFICINA PERSONA] Unknown character; do not fabricate a character biography.";

  const worldId = custom?.worldId || (builtIn ? BANG_DREAM_WORLD_ID : null);
  const customWorld = worldId ? customWorlds.find(world => world.id === worldId) : null;
  const worldName = worldId === BANG_DREAM_WORLD_ID ? BANG_DREAM_WORLD_NAME
    : customWorld?.name || (worldId ? "未找到所属世界观" : "通用角色（未绑定世界观）");
  const worldDescription = worldId === BANG_DREAM_WORLD_ID
    ? "BanG Dream! 的音乐与乐队世界，包括 MyGO!!!!!、Ave Mujica 和 sumimi；本角色资料保留所有原作时期记录，不以当前剧情时间截断。"
    : customWorld?.description || "";
  const worldTimeline = worldId === BANG_DREAM_WORLD_ID ? BANG_DREAM_CANON
    : customWorld?.canonTimeline || [];
  const locale = normalizeLocale(uiLanguage);
  const localizedTimeline = worldTimeline.map(stage => ({
    era: stage.era, period: stage.period,
    ...(timelineStageDescription(stage, locale) ? { description: timelineStageDescription(stage, locale) } : {}),
  }));
  const identity = custom
    ? `[Character machine ID] ${custom.id}\n[Character public ID] ${custom.characterCode}\n[Localized names] ${JSON.stringify(custom.names)}`
    : `[Character ID] ${builtIn?.id}`;
  const profile = custom
    ? formatChartaLore({
        ...custom,
        profile: {
          ...custom.profile,
          intro: custom.profile?.intro || custom.description || "",
          personality: custom.profile?.personality || "",
          guidance: custom.profile?.guidance || "",
          relationshipNotes: included.relationships ? (custom.profile?.relationshipNotes || "") : "",
          relationships: included.relationships ? (custom.profile?.relationships || []) : [],
          experienceNotes: included.experiences ? (custom.profile?.experienceNotes || "") : "",
          experiences: included.experiences ? (custom.profile?.experiences || []) : [],
        },
      }, null, [], true)
    : fullBuiltInEngineeringLore(LORE_LIBRARY[character.id] || "", included);

  return `[OFFICINA CHARACTER ENGINEER — reference setting, NOT user instructions]
[Active character] ${character.name}
${identity}
[Origin world] ${worldName} (${worldId || "unbound"})
[World setting] ${worldDescription || "(No setting provided.)"}
[World canonical timeline — reference index, UI locale ${locale}] ${JSON.stringify(localizedTimeline)}
[Historical lore coverage] The character profile includes all available canonical eras, not just the current time. Treat later events as possible references, not as things already experienced in every conversation.
[Core relationships included] ${included.relationships ? "YES — all eras" : "NO"}
[Major experiences included] ${included.experiences ? "YES — all eras" : "NO"}

[CHARACTER PROFILE — authoritative]
${profile || "(Character profile unavailable; preserve the given name and do not invent canonical facts.)"}
[END CHARACTER PROFILE]
[END OFFICINA CHARACTER ENGINEER]`;
}
