import type { Session, ChatFolder } from "../types";
import type { Locale } from "./locale";
import { defaultSessionTitle, officinaUnassignedWelcome } from "./sessionTitles";

export type CloudSessionSnapshot = {
  sessions: Session[];
  folders: ChatFolder[];
  globalWorldInfo: string;
  bgImage: string | null;
};

/** Persist a first-run greeting as a clean checkpoint, not as a user edit. */
export function withCloudGenesisSession(data: CloudSessionSnapshot, locale: Locale, now: number): CloudSessionSnapshot {
  if (data.sessions.length) return data;
  const greeting: Session = {
    id: String(now),
    title: defaultSessionTitle("infinite", locale),
    folderId: null,
    characterId: "",
    engineeringCharacterLocked: false,
    voiceVariant: "default",
    memoryMode: "infinite",
    messages: [{
      role: "assistant",
      content: officinaUnassignedWelcome(locale),
      modelName: "System",
    }],
    updatedAt: now,
  };
  return { ...data, sessions: [greeting] };
}
