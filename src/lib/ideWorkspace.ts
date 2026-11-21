import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { applyIdeEditsToText } from "./ideEdits";
import { validProjectName, validRelativePath, isWorkspaceTextFile } from "./idePathPolicy";

export const IDE_ROOT = path.join(process.cwd(), "IDE");
const MAX_FILE_BYTES = 512 * 1024;
const MAX_PROJECT_FILES = 500;
type TreeEntry = { path: string; type: "file" | "directory"; size?: number };
export type WorkspaceFile = { name: string; language: string; content: string };
const MAX_DEPTH = 14;

async function baseDirectory(): Promise<string> {
  const stat = await fs.lstat(IDE_ROOT).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
  if (!stat) await fs.mkdir(IDE_ROOT, { recursive: true });
  else if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("IDE 根目录不安全。");
  return IDE_ROOT;
}
async function safePath(project: unknown, relative = "", createParent = false): Promise<string> {
  const root = await baseDirectory();
  const p = validProjectName(project);
  const parts = relative ? validRelativePath(relative).split("/") : [];
  let current = root;
  for (const part of [p, ...parts]) {
    current = path.join(current, part);
    let stat = await fs.lstat(current).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
    if (!stat && createParent && (part === p || part !== parts[parts.length - 1])) {
      await fs.mkdir(current).catch(error => { if (error.code !== "EEXIST") throw error; });
      stat = await fs.lstat(current);
    }
    if (stat?.isSymbolicLink()) throw new Error("禁止访问符号链接。");
  }
  return current;
}
export async function listProjects(): Promise<string[]> {
  const root = await baseDirectory();
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries.filter(item => item.isDirectory() && !item.isSymbolicLink())
    .flatMap(item => { try { validProjectName(item.name); return [item.name]; } catch { return []; } })
    .sort((a, b) => a.localeCompare(b));
}
export async function createProject(project: unknown): Promise<string> {
  const name = validProjectName(project);
  await baseDirectory();
  const existing = await fs.lstat(path.join(IDE_ROOT, name)).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
  if (existing) {
    if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error("同名项目不可用。");
    return name;
  }
  await fs.mkdir(path.join(IDE_ROOT, name));
  return name;
}
export async function listWorkspaceFiles(project: unknown): Promise<TreeEntry[]> {
  const root = await safePath(project);
  if (!(await fs.stat(root).catch(() => null))?.isDirectory()) throw new Error("项目不存在。");
  const result: TreeEntry[] = [];
  async function walk(folder: string, relative: string, depth: number): Promise<void> {
    if (depth >= MAX_DEPTH || result.length >= MAX_PROJECT_FILES) return;
    const entries = await fs.readdir(folder, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (result.length >= MAX_PROJECT_FILES) return;
      const rel = [relative, entry.name].filter(Boolean).join("/");
      try { validRelativePath(rel); } catch { continue; }
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        result.push({ path: rel, type: "directory" });
        await walk(path.join(folder, entry.name), rel, depth + 1);
      } else if (entry.isFile() && isWorkspaceTextFile(rel)) {
        const stat = await fs.stat(path.join(folder, entry.name));
        if (stat.size <= MAX_FILE_BYTES) result.push({ path: rel, type: "file", size: stat.size });
      }
    }
  }
  await walk(root, "", 0);
  return result;
}
export async function readWorkspaceFile(project: unknown, relative: unknown, startLine = 1, endLine = 160) {
  const rel = validRelativePath(relative);
  if (!isWorkspaceTextFile(rel)) throw new Error("不支持读取此类文件。");
  const filename = await safePath(project, rel);
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("文件过大或不是文本文件。");
  const data = await fs.readFile(filename, "utf8");
  if (data.includes("\u0000") || data.includes("\ufffd")) throw new Error("不支持二进制文件。");
  const lines = data.split(/\r?\n/);
  const start = Number.isSafeInteger(startLine) ? Math.max(1, startLine) : 1;
  const end = Number.isSafeInteger(endLine) ? Math.min(lines.length, start + 199, Math.max(start, endLine)) : Math.min(lines.length, start + 159);
  return { path: rel, startLine: start, endLine: end, totalLines: lines.length,
    content: lines.slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join("\n") };
}
export async function searchWorkspace(project: unknown, query: unknown) {
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 120) throw new Error("搜索词长度应为 2–120 字符。");
  const files = (await listWorkspaceFiles(project)).filter(e => e.type === "file").slice(0, 250);
  const matches: { path: string; line: number; excerpt: string }[] = [];
  for (const file of files) {
    if (matches.length >= 45) break;
    const stat = await fs.stat(await safePath(project, file.path)).catch(() => null);
    if (!stat || stat.size > 100 * 1024) continue;
    const content = await fs.readFile(await safePath(project, file.path), "utf8");
    if (content.includes("\u0000")) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query.toLowerCase())) {
        matches.push({ path: file.path, line: i + 1, excerpt: lines[i].slice(0, 240) });
        if (matches.length >= 45) break;
      }
    }
  }
  return matches;
}
export async function createWorkspaceFolder(project: unknown, relative: unknown): Promise<void> {
  const rel = validRelativePath(relative);
  const parts = rel.split("/");
  await createProject(project);
  let partial = "";
  for (const part of parts) {
    partial = partial ? partial + "/" + part : part;
    const dest = await safePath(project, partial);
    const stat = await fs.lstat(dest).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
    if (stat && !stat.isDirectory()) throw new Error("同名文件已存在。");
    if (!stat) await fs.mkdir(dest);
  }
}
export async function writeWorkspaceFile(project: unknown, relative: unknown, content: unknown): Promise<void> {
  const rel = validRelativePath(relative);
  if (!isWorkspaceTextFile(rel)) throw new Error("不支持写入此类文件。");
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES)
    throw new Error("文件内容过大。");
  await createProject(project);
  const parts = rel.split("/");
  if (parts.length > 1) await createWorkspaceFolder(project, parts.slice(0, -1).join("/"));
  const destination = await safePath(project, rel);
  const existing = await fs.lstat(destination).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
  if (existing && !existing.isFile()) throw new Error("文件路径不可覆盖。");
  await fs.writeFile(destination, content, { encoding: "utf8", flag: "w" });
}
/** Preview a precise edit without writing. A version hash prevents overwriting later user edits. */
export async function previewWorkspaceEdit(project: unknown, relative: unknown, edits: unknown) {
  const rel = validRelativePath(relative);
  if (!isWorkspaceTextFile(rel)) throw new Error("不允许编辑受保护文件。");
  const filename = await safePath(project, rel);
  const stat = await fs.lstat(filename);
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("目标必须是现有的文本文件。");
  const original = await fs.readFile(filename, "utf8");
  if (original.includes("\u0000") || original.includes("\ufffd")) throw new Error("不能编辑二进制文件。");
  const version = createHash("sha256").update(original, "utf8").digest("hex");
  const updated = applyIdeEditsToText(original, edits);
  if (updated === original) throw new Error("局部编辑没有产生变化。");
  if (Buffer.byteLength(updated, "utf8") > MAX_FILE_BYTES) throw new Error("修改后文件过大。");
  return { path: rel, version, original, updated };
}

/** Recheck the exact preview before committing; stage to a temp file then rename. */
export async function applyWorkspaceEdit(project: unknown, relative: unknown, edits: unknown,
  expectedVersion: unknown): Promise<void> {
  if (typeof expectedVersion !== "string" || !/^[a-f0-9]{64}$/.test(expectedVersion))
    throw new Error("缺少有效文件版本，请先预览修改。");
  const preview = await previewWorkspaceEdit(project, relative, edits);
  if (preview.version !== expectedVersion) throw new Error("文件已发生变化，请重新预览后再应用。");
  const filename = await safePath(project, preview.path);
  const before = await fs.lstat(filename);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("文件路径不安全。");
  const temporary = path.join(path.dirname(filename), `ide-edit-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, preview.updated, { encoding: "utf8", flag: "wx", mode: before.mode });
    // Recheck right before replacement to avoid writing on an obsolete base.
    const latest = await fs.readFile(filename, "utf8");
    if (createHash("sha256").update(latest, "utf8").digest("hex") !== expectedVersion)
      throw new Error("文件在确认过程中已变化，未写入修改。");
    await fs.rename(temporary, filename);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

export async function deleteWorkspaceFile(project: unknown, relative: unknown): Promise<void> {
  const rel = validRelativePath(relative);
  const destination = await safePath(project, rel);
  const stat = await fs.lstat(destination);
  if (!stat.isFile()) throw new Error("只能删除文件，不能批量删除目录。");
  await fs.unlink(destination);
}
export async function workspaceSnapshot(project: unknown): Promise<Record<string, WorkspaceFile>> {
  const tree = (await listWorkspaceFiles(project)).filter(e => e.type === "file");
  const result: Record<string, WorkspaceFile> = {};
  for (const entry of tree) {
    try {
      const full = await safePath(project, entry.path);
      const content = await fs.readFile(full, "utf8");
      if (content.includes("\u0000") || content.includes("\ufffd")) continue;
      result[entry.path] = { name: entry.path, language: path.extname(entry.path).slice(1) || "text", content };
    } catch { /* changed on disk during snapshot */ }
  }
  return result;
}
