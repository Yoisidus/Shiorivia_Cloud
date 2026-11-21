import { validRelativePath, isWorkspaceTextFile } from "./idePathPolicy";

/** Small, line-addressed changes to an EXISTING IDE file; no full-file output needed. */
export type IdeEditOperation = {
  op: "insert_before" | "insert_after" | "replace" | "delete";
  startLine: number;
  endLine?: number;
  expected: string;
  text?: string;
};
export type IdeEditBlock = { path: string; edits: IdeEditOperation[] };

const OPERATIONS = new Set(["insert_before", "insert_after", "replace", "delete"]);

export function validateIdeEdits(value: unknown): IdeEditOperation[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20)
    throw new Error("一次局部编辑必须包含 1–20 条操作。");
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("IDE 编辑操作格式不正确。");
    const edit = item as Record<string, unknown>;
    if (typeof edit.op !== "string" || !OPERATIONS.has(edit.op)
      || !Number.isSafeInteger(edit.startLine) || (edit.startLine as number) < 1
      || (edit.endLine !== undefined && (!Number.isSafeInteger(edit.endLine) || (edit.endLine as number) < (edit.startLine as number)))
      || typeof edit.expected !== "string" || !edit.expected.length
      || edit.expected.length > 24000)
      throw new Error("编辑位置、操作类型或原始代码不正确。");
    const startLine = edit.startLine as number;
    const endLine = (edit.endLine ?? edit.startLine) as number;
    if (endLine - startLine > 119) throw new Error("单次修改不能超过 120 行。");
    if ((edit.op === "insert_before" || edit.op === "insert_after") && endLine !== startLine)
      throw new Error("插入操作只能指定单行锚点。");
    if (edit.op !== "delete" && (typeof edit.text !== "string" || !edit.text.length || edit.text.length > 32000))
      throw new Error("插入和替换操作必须提供新代码。");
    if (edit.op !== "delete" && (edit.text as string).endsWith("\n"))
      throw new Error("新代码末尾不需要额外换行符。");
    return {
      op: edit.op as IdeEditOperation["op"], startLine,
      endLine, expected: edit.expected,
      ...(edit.op !== "delete" ? { text: edit.text as string } : {}),
    };
  });
}

export function applyIdeEditsToText(source: string, rawEdits: unknown): string {
  const edits = validateIdeEdits(rawEdits);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const original = source.replace(/\r\n/g, "\n");
  const lines = original.split("\n");
  const total = lines.length - (original.endsWith("\n") ? 1 : 0);
  const ranges = edits.map(edit => {
    const end = edit.endLine ?? edit.startLine;
    if (end > total) throw new Error("目标行号已超出文件范围，请重新读取代码。");
    const actual = lines.slice(edit.startLine - 1, end).join("\n");
    if (actual !== edit.expected.replace(/\r\n/g, "\n"))
      throw new Error("原代码与当前文件不一致（行 " + edit.startLine + "），已拒绝修改。");
    return { ...edit, end };
  });
  const occupied = new Set<number>();
  for (const edit of ranges) {
    for (let line = edit.startLine; line <= edit.end; line++) {
      if (occupied.has(line)) throw new Error("同一行不能在一次编辑中被多次修改。");
      occupied.add(line);
    }
  }
  // Validate all anchors against the same original file, then apply from bottom to top.
  const modified = [...lines];
  for (const edit of ranges.sort((a, b) => b.startLine - a.startLine)) {
    const count = edit.end - edit.startLine + 1;
    const inserted = edit.text?.replace(/\r\n/g, "\n").split("\n") || [];
    switch (edit.op) {
      case "insert_before": modified.splice(edit.startLine - 1, 0, ...inserted); break;
      case "insert_after": modified.splice(edit.end, 0, ...inserted); break;
      case "replace": modified.splice(edit.startLine - 1, count, ...inserted); break;
      case "delete": modified.splice(edit.startLine - 1, count); break;
    }
  }
  return modified.join("\n").replace(/\n/g, newline);
}

/** Strip complete, validated edit requests; malformed output stays visible, never executes. */
export function extractIdeEditBlocks(response: string): { text: string; blocks: IdeEditBlock[] } {
  const blocks: IdeEditBlock[] = [];
  const cleaned = response.replace(/<ide_edit\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/ide_edit>/gi,
    (_match, pathValue: string, payload: string) => {
      const path = validRelativePath(pathValue);
      if (!isWorkspaceTextFile(path)) throw new Error("不允许编辑受保护的文件：" + path);
      const decoded: unknown = JSON.parse(payload);
      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded))
        throw new Error("IDE 编辑内容必须是 JSON 对象。");
      blocks.push({ path, edits: validateIdeEdits((decoded as Record<string, unknown>).edits) });
      if (blocks.length > 8) throw new Error("单轮最多编辑 8 个文件。");
      return "";
    });
  if (/<\/?ide_edit\b/i.test(cleaned))
    throw new Error("局部编辑标签不完整，请重新生成编辑指令。");
  const paths = blocks.map(block => block.path);
  if (new Set(paths).size !== paths.length)
    throw new Error("同一文件只能提交一个局部编辑块。");
  return { text: cleaned.trim(), blocks };
}
