/** Metadata emitted in the SAME generation as the visible response. */
export const INLINE_TITLE_TAG = "session_title";

export function shouldReviewInlineTitle(userTurn: number): boolean {
  return Number.isInteger(userTurn) && userTurn > 0 && (userTurn - 1) % 4 === 0;
}

export function titleInstruction(currentTitle: string, userTurn: number, manual: boolean, novel: boolean, story = false): string {
  const eligible = shouldReviewInlineTitle(userTurn) && !manual;
  const title = JSON.stringify(String(currentTitle || "").slice(0, 100));
  return [
    "[INLINE SESSION TITLE — SAME RESPONSE, NO EXTRA API REQUEST]",
    `Current saved conversation title: ${title}. User turn: ${userTurn}. Manually renamed: ${manual ? "YES" : "NO"}.`,
    eligible
      ? "You MUST review whether the saved title accurately describes the CURRENT conversation and memory, including changed focus after deletions. "
        + (story
          ? "In Story, FIRST output <thinking>...</thinking>, THEN exactly ONE <session_title>NEW_TITLE_OR_KEEP</session_title> immediately after the closing thinking tag, BEFORE story prose."
          : novel
            ? "Review the saved novel title and decide whether to KEEP it or replace it with a concise meaningful title in the active UI language. The central Tela output contract defines the location and syntax of the session_title tag."
            : "At the start of your response emit exactly ONE <session_title>NEW_TITLE_OR_KEEP</session_title> tag.")
        + " Use KEEP if the current title still fits; otherwise a concise meaningful new title in the active UI language. Do not use the words NEW_TITLE_OR_KEEP literally."
      : "Do NOT emit a <session_title> tag this turn. The saved session title must remain unchanged.",
    novel
      ? "Novel chapter metadata and title placement are defined exclusively by TELA OUTPUT CONTRACT. Apply the above title review decision consistently."
      : story
        ? "Story output order: <thinking>...</thinking>, optional <session_title>...</session_title> only on review turns, visible story prose, and finally <game_state> JSON. Do not place title metadata inside thinking or prose."
        : "Put session_title before the visible reply (but AFTER novel <meta>), and do not quote or explain the tag. Do not let it interrupt story prose, code blocks or game_state JSON.",
    "[END INLINE SESSION TITLE]",
  ].join("\n");
}

/** Return sanitized visible output + safe proposed title; never interpret prose as metadata. */
export function extractInlineTitle(text: string): { text: string; title: string | null } {
  let candidate: string | null = null;
  const clean = String(text || "").replace(/<session_title\s*>([\s\S]*?)<\/session_title\s*>/gi,
    (match: string, raw: string, index: number, source: string) => {
      // Metadata belongs at the start (or after novel <meta>). Never remove
      // a literal XML example embedded in a source file or normal prose.
      const prefix = source.slice(0, index).trim();
      // Via Lata emits a closed <thinking> block before title metadata.
      // Strip ONLY an anchored complete prefix; never interpret arbitrary
      // inline tag examples, code samples or ordinary prose as a title.
      const afterThinking = prefix.replace(/^<thinking\b[^>]*>[\s\S]*?<\/thinking\s*>/i, "").trim();
      const afterNovelMeta = /^<meta\s+title=["'][^"']+["']\s+chapter=["'][^"']+["']\s*\/\s*>$/i.test(afterThinking);
      if (index > 16000 || (afterThinking.length > 0 && !afterNovelMeta)) return match;
      if (candidate === null) {
        const value = raw.trim().replace(/[<>\r\n]/g, " ").trim();
        candidate = value && value.length <= 100 && !/^KEEP$/i.test(value) ? value : "";
      }
      return "";
    });
  return { text: clean.trimStart(), title: candidate || null };
}
