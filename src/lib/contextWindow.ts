/**
 * Shared prompt budget for all five Local spaces.
 * Values describe the target total context window (including system instructions
 * and reserved output), NOT a guarantee about third-party model limits.
 */
export const CONTEXT_WINDOW_OPTIONS = [65536, 131072, 262144, 524288, 1048576] as const;
export type ContextWindowTokens = (typeof CONTEXT_WINDOW_OPTIONS)[number];
export const DEFAULT_CONTEXT_WINDOW_TOKENS: ContextWindowTokens = 262144;

export function normalizeContextWindowTokens(value: unknown): ContextWindowTokens {
  if (CONTEXT_WINDOW_OPTIONS.includes(value as ContextWindowTokens)) return value as ContextWindowTokens;
  // The former 32K default should become the new 256K default, not a 64K cap.
  if (value === 32768) return DEFAULT_CONTEXT_WINDOW_TOKENS;
  // Migrate legacy Local presets to the closest supported tier at least as
  // large as the former user-selected limit. Never silently shrink old choices.
  if (typeof value === "number" && Number.isFinite(value) && value > 0
      && value <= CONTEXT_WINDOW_OPTIONS[CONTEXT_WINDOW_OPTIONS.length - 1]) {
    return CONTEXT_WINDOW_OPTIONS.find(limit => limit >= value) || DEFAULT_CONTEXT_WINDOW_TOKENS;
  }
  return DEFAULT_CONTEXT_WINDOW_TOKENS;
}

export type ContextMessage = { role: string; content: unknown; [key: string]: unknown };

/** A conservative UTF-8-based approximation; not an exact provider tokenizer. */
export function estimateContextTokens(value: unknown): number {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (!text) return 0;
  // Asian scripts cost considerably more tokens per character than ASCII prose.
  // bytes/2.5 intentionally errs toward counting MORE than typical tokenizers.
  return Math.max(1, Math.ceil(new TextEncoder().encode(text).byteLength / 2.5));
}

export function contextOutputReserve(windowTokens: number): number {
  return Math.max(2048, Math.min(8192, Math.ceil(windowTokens * 0.2)));
}

export class ContextWindowError extends Error {
  constructor(message: string) { super(message); this.name = "ContextWindowError"; }
}

export function selectContextMessages<T extends ContextMessage>(
  allMessages: readonly T[],
  systemPrompt: string,
  requestedWindow: unknown,
): { messages: T[]; requestedTokens: ContextWindowTokens; availableTokens: number; usedTokens: number; omitted: number } {
  const requestedTokens = normalizeContextWindowTokens(requestedWindow);
  const availableTokens = requestedTokens - contextOutputReserve(requestedTokens);
  const systemTokens = estimateContextTokens(systemPrompt) + 128; // protocol overhead
  if (systemTokens >= availableTokens) {
    throw new ContextWindowError(
      `当前人物设定、世界线和工具资料约占 ${systemTokens} Token，超出 ${requestedTokens} Token 上下文窗口的输入预算。请在通用设置中调大窗口或减少资料。`,
    );
  }
  if (!allMessages.length) throw new ContextWindowError("上下文缺少用户输入，未发送模型请求。");
  const result: T[] = [];
  let usedTokens = systemTokens;
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const message = allMessages[i];
    const cost = estimateContextTokens(message.content) + estimateContextTokens(message.role) + 20;
    if (usedTokens + cost > availableTokens) {
      if (i === allMessages.length - 1) {
        throw new ContextWindowError(
          `最新一条消息加上系统设定超过 ${requestedTokens} Token 窗口。请增大上下文预算或缩短该条内容；未发送模型请求。`,
        );
      }
      break; // recent contiguous history, never split individual messages
    }
    result.push(message);
    usedTokens += cost;
  }
  result.reverse();
  return { messages: result, requestedTokens, availableTokens, usedTokens, omitted: allMessages.length - result.length };
}
