import { deepText } from "./i18nDeep";
import type { Locale } from "./locale";

/**
 * Presentation-only fallback for models that serialize visible Officina prose
 * as literal "\n" characters. Never use this for code edits or on-disk files.
 *
 * Fenced/inline code and IDE XML payloads are protected, including unfinished
 * tags or fences that may arrive while the stream is still growing.
 */
export function normalizeOfficinaDisplay(text: string): string {
  if (!text.includes("\\n") && !text.includes("\\r\\n")) return text;
  const protectedRegions = /<ide_edit\b[\s\S]*?(?:<\/ide_edit\s*>|$)|<file\b[\s\S]*?(?:<\/file\s*>|$)|\x60{3}[\s\S]*?(?:\x60{3}|$)|\x60[^\x60\n]*(?:\x60|$)/gi;
  const normalizeProse = (value: string) => {
    // Avoid treating a lone escape in a pathname or JS example as a newline.
    const escaped = value.match(/(?<!\\)\\(?:r\\n|n)/g) || [];
    if (escaped.length < 2 && !/(?<!\\)\\n(?=[ \t]|$)/.test(value)) return value;
    return value.replace(/(?<!\\)\\r\\n|(?<!\\)\\n/g, "\n");
  };
  let result = "";
  let position = 0;
  for (const match of text.matchAll(protectedRegions)) {
    const index = match.index ?? 0;
    result += normalizeProse(text.slice(position, index)) + match[0];
    position = index + match[0].length;
  }
  return result + normalizeProse(text.slice(position));
}

/**
 * File-code blocks are display-only: never modify the raw model payload or
 * on-disk source. Dynamic fence length also handles embedded Markdown fences.
 */
export function formatOfficinaFullFiles(text: string, locale: Locale = "zh-CN"): string {
  const fileBlock = /<file\s+name=(["'])([^"'<>]{1,240})\1\s*>([\s\S]*?)(<\/file\s*>|$)/gi;
  const formatted = text.replace(fileBlock, (_whole, _quote: string, path: string, source: string, closing: string) => {
    const code = source.replace(/\r\n/g, "\n");
    const longest = [...code.matchAll(/~+/g)].reduce((max, match) => Math.max(max, match[0].length), 2);
    const fence = "~".repeat(Math.max(3, longest + 1));
    const extension = path.split(".").pop()?.toLowerCase() || "";
    const language = /^[a-z0-9+#-]{1,24}$/.test(extension) ? extension : "";
    const safePath = path.replace(/[^\p{L}\p{N}._/ -]/gu, "_");
    return "\n\n" + deepText(locale, "officina.display.file") + " · " + safePath + (closing ? "" : " · " + deepText(locale, "officina.display.generating"))
      + "\n\n" + fence + language + "\n" + code
      + (code.endsWith("\n") ? "" : "\n") + fence + "\n\n";
  });
  // A stream can also terminate partway through the opening HTML-like tag.
  return formatted.replace(/<file\b[^>\r\n]*$/i, "\n\n" + deepText(locale, "officina.display.preparingFile"));
}

/**
 * The streaming response contains machine-readable <ide_edit> JSON while the
 * edit is still in flight. Present decoded line changes, never raw JSON with
 * escaped "\\n" strings. Raw model text remains unchanged for processing.
 */
export function formatOfficinaStreamingDisplay(raw: string, locale: Locale = "zh-CN"): string {
  const text = normalizeOfficinaDisplay(raw);
  const formatted = text.replace(/<ide_edit\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/ide_edit\s*>/gi,
    (_full, filePath: string, payload: string) => {
      try {
        const data: unknown = JSON.parse(payload);
        if (!data || typeof data !== "object" || !Array.isArray((data as { edits?: unknown }).edits))
          return "\n\n" + deepText(locale, "officina.display.parsingEdits") + "\n";
        const edits = (data as { edits: Array<Record<string, unknown>> }).edits;
        const changes: string[] = [];
        for (const edit of edits.slice(0, 10)) {
          const op = String(edit.op || "");
          const position = String(edit.startLine ?? "?");
          changes.push("@@ " + op + " · L" + position + " @@");
          if (typeof edit.expected === "string") {
            const prefix = op.startsWith("insert_") ? "  " : "- ";
            changes.push(...edit.expected.split(/\r?\n/).map(line => prefix + line));
          }
          if (typeof edit.text === "string" && op !== "delete") {
            changes.push(...edit.text.split(/\r?\n/).map(line => "+ " + line));
          }
        }
        if (edits.length > 10) changes.push(deepText(locale, "officina.display.moreEdits").replace("{count}", String(edits.length - 10)));
        const preview = changes.map(line => "    " + line).join("\n");
        return "\n\n**" + deepText(locale, "officina.display.editPreview") + " · " + filePath + "**\n\n" + preview + "\n\n";
      } catch {
        return "\n\n" + deepText(locale, "officina.display.parsingEdits") + "\n";
      }
    });
  // Partial model chunks may end in the middle of JSON. Never print broken
  // editing instructions into the chat bubble while streaming.
  return formatOfficinaFullFiles(formatted.replace(/<ide_edit\b[\s\S]*$/i, "\n\n" + deepText(locale, "officina.display.preparingEdits")), locale);
}
