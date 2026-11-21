import type { Session } from "../types";

/** Snapshots are attached to the assistant message, not the session head:
 * removing the latest answer or its preceding user request can restore the
 * state that existed BEFORE that generation. They survive Local JSON saves.
 */
const STATE_FIELDS = [
  "stm", "ltm", "stmBackup", "turnCount", "protagonist", "charStatus",
  "plotSuggestions", "timeline", "sceneCastIds", "storyNextCastIds", "storyAllowCrossWorld", "lastDanmaku",
  "currentBackground", "live2dCharId", "currentEmotion", "currentOutfitId",
  "storyPovId", "storyPovLocked",
] as const;

type StateField = typeof STATE_FIELDS[number];
export type StoryStateSnapshot = {
  fields: Partial<Pick<Session, StateField>>;
  worldlineEvent: string;
};

function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

export function snapshotStoryState(session: Session): StoryStateSnapshot {
  const fields: Record<string, unknown> = {};
  for (const key of STATE_FIELDS) fields[key] = copy(session[key]);
  return { fields: fields as StoryStateSnapshot["fields"], worldlineEvent: session.storyWorldline?.event || "" };
}

/** A brand-new story keeps its selected world/ERA/PERIOD and chosen role/self,
 * but has no AI-generated state, memories, cast, POV or event. */
export function emptyStoryState(session: Session): Session {
  return {
    ...session,
    stm: "", ltm: "", stmBackup: undefined, turnCount: 0,
    protagonist: undefined, charStatus: undefined, plotSuggestions: undefined,
    timeline: undefined, sceneCastIds: [], storyNextCastIds: [], lastDanmaku: [],
    currentBackground: undefined, live2dCharId: undefined,
    currentEmotion: undefined, currentOutfitId: undefined,
    storyPovId: null, storyPovLocked: false,
    storyWorldline: session.storyWorldline
      ? { ...session.storyWorldline, event: "" } : undefined,
  };
}

export function restoreStoryState(session: Session, snapshot: StoryStateSnapshot | undefined): Session {
  if (!snapshot || !snapshot.fields || typeof snapshot.fields !== "object") {
    // Old saves did not contain per-turn checkpoints. Better to clear stale
    // state than pretend it still belongs to the shortened conversation.
    return emptyStoryState(session);
  }
  const fields: Record<string, unknown> = {};
  for (const key of STATE_FIELDS) fields[key] = copy(snapshot.fields[key]);
  return {
    ...session,
    ...fields,
    storyWorldline: session.storyWorldline
      ? { ...session.storyWorldline, event: snapshot.worldlineEvent || "" } : undefined,
  } as Session;
}

/** Model responses from different gateways can use equivalent, but not identical,
 * names/shapes. Normalize only well-defined aliases, without inventing missing
 * required story data or treating every syntactically valid JSON as usable.
 */
type StoryObject = Record<string, unknown>;
const isRecord = (v: unknown): v is StoryObject =>
  !!v && typeof v === "object" && !Array.isArray(v);

const SUGGESTION_TYPES = ["fun", "rational", "radical"] as const;
const TIMELINE_TYPES = ["era", "period", "event"] as const;

/** Returns a new value; never mutates the untrusted model response. */
export function normalizeStoryProtocol(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const state: StoryObject = { ...value };

  // Common alternative: [{ tag:"fun", text:"..." }, ...] instead of
  // { fun:"...", rational:"...", radical:"..." }.
  if (Array.isArray(state.suggestions)) {
    const normalized: StoryObject = {};
    for (const entry of state.suggestions) {
      if (!isRecord(entry)) continue;
      const tag = entry.tag ?? entry.type;
      const text = entry.text ?? entry.description;
      if (SUGGESTION_TYPES.some(key => key === tag) && typeof text === "string") {
        normalized[String(tag)] = text;
      }
    }
    state.suggestions = normalized;
  }

  // Normalize old story archives and equivalent timeline arrays to
  // era/period/event without silently inventing the actual worldline.
  if (Array.isArray(state.timeline)) {
    const normalized: StoryObject = { era: "", period: "", event: "" };
    const aliases: Record<string,string> = { major:"era", medium:"period", minor:"event" };
    for (const entry of state.timeline) {
      if (!isRecord(entry)) continue;
      const rawKey = String(entry.type ?? entry.tag ?? "");
      const key = aliases[rawKey] || rawKey;
      const description = entry.description ?? entry.text;
      if (TIMELINE_TYPES.some(item => item === key) && typeof description === "string") {
        normalized[key] = description;
      }
    }
    state.timeline = normalized;
  } else if (isRecord(state.timeline)) {
    const old = state.timeline;
    state.timeline = {
      era: typeof old.era === "string" ? old.era : typeof old.major === "string" ? old.major : "",
      period: typeof old.period === "string" ? old.period : typeof old.medium === "string" ? old.medium : "",
      event: typeof old.event === "string" ? old.event : typeof old.minor === "string" ? old.minor : "",
    };
  }

  // The model may use charId/characterName rather than id/name, and
  // favorability rather than affection. Do not guess how "trust" maps to
  // another score; retain it as additional text/state data.
  if (Array.isArray(state.character)) {
    state.character = state.character.map(value => {
      if (!isRecord(value)) return value;
      const entry: StoryObject = { ...value };
      if (typeof entry.id !== "string" && typeof entry.charId === "string") entry.id = entry.charId;
      if (typeof entry.name !== "string" && typeof entry.characterName === "string") entry.name = entry.characterName;
      if (typeof entry.innerState !== "string" && typeof entry.innerPsychology === "string") {
        entry.innerState = entry.innerPsychology;
      }
      if (typeof entry.bodyState !== "string" && typeof entry.status === "string") {
        entry.bodyState = entry.status;
      }
      if (typeof entry.Lust !== "number" && typeof entry.Intimacy === "number"
          && Number.isFinite(entry.Intimacy)) entry.Lust = entry.Intimacy;
      if (typeof entry.affection !== "number" && typeof entry.favorability === "number"
          && Number.isFinite(entry.favorability)) {
        entry.affection = entry.favorability;
      }
      return entry;
    });
  }
  return state;
}

/** Strict structural errors, primarily for useful diagnostics after a repair. */
export function storyProtocolIssues(value: unknown): string[] {
  if (!isRecord(value)) return ["game_state 必须为 JSON 对象"];
  const issues: string[] = [];
  if (!("protagonist" in value) || (value.protagonist !== null && !isRecord(value.protagonist))) {
    issues.push("protagonist 必须为对象或 null");
  } else if (isRecord(value.protagonist)) {
    for (const key of ["name", "timeDesc", "environment", "temperature", "clothing", "sensation", "innerState"]) {
      if (typeof value.protagonist[key] !== "string") issues.push("protagonist." + key + " 必须为字符串");
    }
  }
  if (!Array.isArray(value.character)) issues.push("character 必须为数组");
  if (!Array.isArray(value.sceneCastIds) || !value.sceneCastIds.every(id => typeof id === "string")) {
    issues.push("sceneCastIds 必须为角色 ID 数组");
  }
  if (!Array.isArray(value.nextSceneCastIds) || !value.nextSceneCastIds.every(id => typeof id === "string")) {
    issues.push("nextSceneCastIds 必须为数组（可为空）");
  }
  if (!Array.isArray(value.danmaku) || !value.danmaku.every(item => typeof item === "string")) {
    issues.push("danmaku 必须为字符串数组");
  }
  if (!isRecord(value.timeline) || ["era", "period", "event"].some(key => typeof (value.timeline as StoryObject)[key] !== "string")) {
    issues.push("timeline 必须包含 era / period / event 字符串");
  }
  if (!("music" in value) || (value.music !== null && !isRecord(value.music))) {
    issues.push("music 必须为对象或 null");
  }
  if (!isRecord(value.suggestions)) {
    issues.push("suggestions 必须为包含 fun / rational / radical 的对象");
  } else {
    for (const key of SUGGESTION_TYPES) {
      if (typeof value.suggestions[key] !== "string") issues.push("suggestions." + key + " 必须为字符串");
    }
  }
  return issues;
}

/** Validate AFTER normalizeStoryProtocol. Keep this narrow to avoid turning
 * harmless missing optional details into extra costly model repair calls.
 */
export function isUsableStoryProtocol(value: unknown): boolean {
  return storyProtocolIssues(value).length === 0;
}
