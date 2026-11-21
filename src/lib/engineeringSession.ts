import type { Session } from "../types";

/** All existing engineering conversations with a user turn are locked automatically. */
export function isEngineeringCharacterLocked(session: Pick<Session, "memoryMode" | "messages" | "engineeringCharacterLocked"> | null | undefined): boolean {
  return session?.memoryMode === "infinite" &&
    (session.engineeringCharacterLocked === true || session.messages.some(message => message.role === "user"));
}

/** Initial interface greetings are visual-only, never model conversation history. */
export function aiConversationMessages<T extends { role: string; modelName?: string }>(messages: readonly T[]): T[] {
  return messages.filter(message => !(message.role === "assistant" && message.modelName === "System"));
}
