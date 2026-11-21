/** Utilities for model output that may discuss protocol tags inside thinking. */
export function stripStoryThinking(raw: string): string {
  // Some gateways expose a closed <thinking> preamble containing literal
  // <game_state> examples. Never parse it as the real trailing state.
  return String(raw || "").replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking\s*>/gi, "").trimStart();
}

export type GameStateBlock = { full: string; json: string; start: number; end: number };

/** Select the LAST complete story state; older in-prose protocol examples are ignored. */
export function lastStoryGameState(raw: string): GameStateBlock | null {
  const text = stripStoryThinking(raw);
  const pattern = /<game_state\s*>([\s\S]*?)<\/game_state\s*>/gi;
  let last: GameStateBlock | null = null;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? -1;
    if (index < 0) continue;
    last = { full: match[0], json: match[1], start: index, end: index + match[0].length };
  }
  return last;
}

/** Isolate only a trailing game_state, retaining the whole narrative. */
export function storyProseWithoutState(raw: string): string {
  const text = stripStoryThinking(raw);
  const block = lastStoryGameState(text);
  if (block) return (text.slice(0, block.start) + text.slice(block.end)).trimEnd();
  // If the provider truncated the last tag, trim ONLY an anchored final
  // protocol block, not an inline mention in prose.
  const open = /(?:^|\n)\s*<game_state\s*>/gi;
  let lastStart = -1;
  for (const match of text.matchAll(open)) lastStart = (match.index ?? -1) + (match[0].startsWith("\n") ? 1 : 0);
  return lastStart >= 0 ? text.slice(0, lastStart).trimEnd() : text;
}
