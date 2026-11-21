"use client";

import { browserRead, browserMutate, browserKeys } from "./browserStore";
import { validProjectName, validRelativePath, isWorkspaceTextFile } from "./idePathPolicy";
import { applyIdeEditsToText } from "./ideEdits";
import type { CodeFile } from "../types";

/** Virtual browser IDE. Project writes validate and commit atomically across tabs. */
type VirtualProject = { files: Record<string, CodeFile>; folders: string[] };
const MAX_FILES = 500;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_PROJECT_BYTES = 5 * 1024 * 1024;
const PROJECT_PREFIX = "ide:project:";
const projectKey = (name: string) => PROJECT_PREFIX + validProjectName(name);
const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const emptyProject = (): VirtualProject => ({ files: {}, folders: [] });

function pathOf(value: unknown): string {
  const path = validRelativePath(value);
  if (!isWorkspaceTextFile(path)) throw new Error("Only safe text/code paths are allowed.");
  return path;
}
async function readProject(project: string): Promise<VirtualProject> {
  const doc = await browserRead<VirtualProject | null>(projectKey(project), null);
  if (!doc) throw new Error("Project does not exist.");
  return doc;
}
const treeOf = (doc: VirtualProject) => {
  const folders = new Set(doc.folders);
  for (const path of Object.keys(doc.files)) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join("/"));
  }
  return [
    ...[...folders].sort().map(path => ({ path, type: "directory" as const })),
    ...Object.keys(doc.files).sort().map(path => ({ path, type: "file" as const, size: doc.files[path].content.length })),
  ];
};
function validateDocument(doc: VirtualProject) {
  const paths = Object.keys(doc.files);
  if (paths.length > MAX_FILES) throw new Error("Too many virtual IDE files.");
  const names = new Set(paths);
  let bytes = 0;
  for (const path of paths) {
    const content = doc.files[path]?.content;
    if (typeof content !== "string") throw new Error("Invalid browser IDE file.");
    const size = new Blob([content]).size;
    if (size > MAX_FILE_BYTES) throw new Error("Virtual IDE file exceeds 256 KiB.");
    bytes += size;
    if (bytes > MAX_PROJECT_BYTES) throw new Error("Virtual IDE project exceeds 5 MiB.");
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      if (names.has(parts.slice(0, i).join("/"))) throw new Error("A file cannot also be a parent directory.");
    }
  }
  for (const folder of doc.folders) {
    if (names.has(folder)) throw new Error("A file cannot also be a directory.");
    const parts = folder.split("/");
    for (let i = 1; i < parts.length; i++) {
      if (names.has(parts.slice(0, i).join("/"))) throw new Error("A file cannot also be a parent directory.");
    }
  }
}
function withProject(project: string, update: (doc: VirtualProject) => VirtualProject) {
  return browserMutate<VirtualProject>(projectKey(project), current => {
    if (!current) throw new Error("Project does not exist.");
    return update(current);
  });
}

export async function browserIde(action: string, args: Record<string, unknown> = {}): Promise<any> {
  if (action === "projects") {
    const keys = await browserKeys(PROJECT_PREFIX);
    return { projects: keys.map(key => key.slice(PROJECT_PREFIX.length)).sort() };
  }
  if (action === "createProject") {
    const project = validProjectName(args.name);
    await browserMutate<VirtualProject>(projectKey(project), doc => {
      if (doc) {
        if (args.exclusive === true) throw new Error("Project already exists; review the target again.");
        return doc;
      }
      return emptyProject();
    });
    return { project };
  }
  const project = validProjectName(args.project);
  if (action === "writeBatch") {
    const raw = args.files, expected = args.expected;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)
      || !expected || typeof expected !== "object" || Array.isArray(expected))
      throw new Error("Invalid batch write.");
    const entries = Object.entries(raw as Record<string, unknown>);
    if (!entries.length || entries.length > MAX_FILES) throw new Error("Invalid IDE file count.");
    const validated = entries.map(([rawPath, content]) => {
      const path = pathOf(rawPath);
      if (typeof content !== "string" || new Blob([content]).size > MAX_FILE_BYTES)
        throw new Error("Text file is too large.");
      if (!own(expected, path) ||
          ((expected as Record<string, unknown>)[path] !== null && typeof (expected as Record<string, unknown>)[path] !== "string"))
        throw new Error("Expected file version is missing.");
      return { path, content };
    });
    await browserMutate<VirtualProject>(projectKey(project), doc => {
      if (args.create === true ? Boolean(doc) : !doc) {
        throw new Error(args.create === true ? "Project was created in another tab; review again." : "Project does not exist.");
      }
      const current = doc || emptyProject();
      const files = { ...current.files };
      for (const { path, content } of validated) {
        const previous = own(current.files, path) ? current.files[path].content : null;
        if (previous !== (expected as Record<string, unknown>)[path])
          throw new Error("Project files changed after review. Reload and review again.");
        const name = path.split("/").pop() || path;
        files[path] = { name, language: name.split(".").pop() || "text", content };
      }
      const next = { ...current, files };
      validateDocument(next);
      return next;
    });
    return { success: true, count: validated.length };
  }
  if (action === "applyEditsBatch" || action === "applyEdit") {
    const raw = action === "applyEdit"
      ? [{ path: args.path, version: args.version, edits: args.edits }] : args.files;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8)
      throw new Error("Invalid IDE patch count.");
    const patches = raw.map(entry => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid IDE patch.");
      const file = entry as Record<string, unknown>;
      return { path: pathOf(file.path), version: file.version, edits: file.edits };
    });
    if (new Set(patches.map(file => file.path)).size !== patches.length)
      throw new Error("Duplicate IDE patch target.");
    await withProject(project, doc => {
      const files = { ...doc.files };
      for (const patch of patches) {
        const previous = own(doc.files, patch.path) ? doc.files[patch.path].content : null;
        if (previous === null || patch.version !== String(previous.length) + ":" + previous)
          throw new Error("File changed after preview. Review the patch again.");
        const content = applyIdeEditsToText(previous, patch.edits);
        files[patch.path] = { ...doc.files[patch.path], content };
      }
      const next = { ...doc, files };
      validateDocument(next);
      return next;
    });
    return { success: true, count: patches.length };
  }

  const doc = await readProject(project);
  if (action === "tree") return { entries: treeOf(doc) };
  if (action === "snapshot") return { files: doc.files, entries: treeOf(doc) };
  if (action === "read") {
    const path = pathOf(args.path);
    const file = own(doc.files, path) ? doc.files[path] : null;
    if (!file) throw new Error("File not found.");
    const lines = file.content.split(/\r?\n/);
    const start = Math.max(1, Math.min(100000, Number(args.start) || 1));
    const end = Math.max(start, Math.min(start + 500, Number(args.end) || start + 160));
    return { path, content: lines.slice(start - 1, end).join("\n"), startLine: start, endLine: end };
  }
  if (action === "search") {
    const query = String(args.query || "").slice(0, 160);
    return { matches: Object.entries(doc.files)
      .filter(([path, file]) => path.includes(query) || file.content.includes(query))
      .slice(0, 200).map(([path]) => ({ path })) };
  }
  if (action === "previewEdit") {
    const path = pathOf(args.path);
    const old = own(doc.files, path) ? doc.files[path] : null;
    if (!old) throw new Error("File not found.");
    const updated = applyIdeEditsToText(old.content, args.edits);
    return { path, original: old.content, updated, version: String(old.content.length) + ":" + old.content };
  }
  if (action === "createFolder") {
    const path = validRelativePath(args.path);
    await withProject(project, latest => {
      if (own(latest.files, path)) throw new Error("A file exists at this folder path.");
      const folders = new Set(latest.folders);
      const parts = path.split("/");
      for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join("/"));
      const next = { ...latest, folders: [...folders] };
      validateDocument(next);
      return next;
    });
    return { success: true };
  }
  if (action === "write") {
    const path = pathOf(args.path), content = args.content;
    if (typeof content !== "string" || new Blob([content]).size > MAX_FILE_BYTES)
      throw new Error("Text file is too large.");
    await withProject(project, latest => {
      const previous = own(latest.files, path) ? latest.files[path].content : null;
      if (own(args, "expected") && previous !== args.expected)
        throw new Error("File changed in another tab. Reload and review.");
      const name = path.split("/").pop() || path;
      const next = { ...latest, files: { ...latest.files,
        [path]: { name, language: name.split(".").pop() || "text", content } } };
      validateDocument(next);
      return next;
    });
    return { success: true };
  }
  if (action === "delete") {
    const path = pathOf(args.path);
    await withProject(project, latest => {
      const previous = own(latest.files, path) ? latest.files[path].content : null;
      if (own(args, "expected") && previous !== args.expected)
        throw new Error("File changed in another tab. Reload and review.");
      const files = { ...latest.files };
      delete files[path];
      return { ...latest, files };
    });
    return { success: true };
  }
  throw new Error("Unsupported virtual IDE operation.");
}
