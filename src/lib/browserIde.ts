"use client";

import { browserRead, browserWrite } from "./browserStore";
import { validProjectName, validRelativePath, isWorkspaceTextFile } from "./idePathPolicy";
import { applyIdeEditsToText } from "./ideEdits";
import type { CodeFile } from "../types";

/** Virtual directory tree held inside this origin's IndexedDB: no server filesystem. */
type VirtualProject = { files: Record<string, CodeFile>; folders: string[] };
const LIST_KEY = "ide:projects";
const MAX_FILES = 500;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_PROJECT_BYTES = 5 * 1024 * 1024;
const projectKey = (name: string) => "ide:project:" + validProjectName(name);
function pathOf(value: unknown) {
  const path = validRelativePath(value);
  if (!isWorkspaceTextFile(path)) throw new Error("Only safe text/code paths are allowed.");
  return path;
}
async function readProject(project: unknown): Promise<VirtualProject> {
  const key = projectKey(project as string);
  const doc = await browserRead<VirtualProject | null>(key, null);
  if (!doc) throw new Error("Project does not exist.");
  return doc;
}
const treeOf = (doc: VirtualProject) => {
  const folders = new Set(doc.folders);
  for (const path of Object.keys(doc.files)) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0,i).join("/"));
  }
  return [
    ...[...folders].sort().map(path=>({path,type:"directory" as const})),
    ...Object.keys(doc.files).sort().map(path=>({path,type:"file" as const,size:doc.files[path].content.length})),
  ];
};
function checkSize(doc: VirtualProject) {
  if (Object.keys(doc.files).length > MAX_FILES) throw new Error("Too many virtual IDE files.");
  const count = Object.values(doc.files).reduce((n,file)=>n+new Blob([file.content]).size,0);
  if (count > MAX_PROJECT_BYTES) throw new Error("Virtual IDE project exceeds 5 MiB.");
}
export async function browserIde(action: string, args: Record<string, unknown> = {}): Promise<any> {
  if (action === "projects") {
    const projects = await browserRead<string[]>(LIST_KEY, []);
    return { projects };
  }
  if (action === "createProject") {
    const project = validProjectName(args.name);
    const projects = await browserRead<string[]>(LIST_KEY, []);
    if (!projects.includes(project)) {
      await browserWrite(projectKey(project), {files:{},folders:[]});
      await browserWrite(LIST_KEY,[...projects,project].sort());
    }
    return {project};
  }
  const project = validProjectName(args.project);
  const doc = await readProject(project);
  if (action === "tree") return {entries:treeOf(doc)};
  if (action === "snapshot") return {files:doc.files};
  if (action === "read") {
    const path = pathOf(args.path);
    const f = doc.files[path];
    if (!f) throw new Error("File not found.");
    const lines = f.content.split(/\r?\n/);
    const start = Math.max(1,Math.min(100000,Number(args.start)||1));
    const end = Math.max(start,Math.min(start+500,Number(args.end)||start+160));
    return {path, content:lines.slice(start-1,end).join("\n"),startLine:start,endLine:end};
  }
  if (action === "search") {
    const query = String(args.query||"").slice(0,160);
    const matches = Object.entries(doc.files).filter(([path,f])=>path.includes(query)||f.content.includes(query)).slice(0,200).map(([path])=>({path}));
    return {matches};
  }
  if (action === "createFolder") {
    const path = pathOf(args.path);
    if (doc.files[path]) throw new Error("A file exists at this folder path.");
    const folders = new Set(doc.folders);
    const parts=path.split("/");
    for(let i=1;i<=parts.length;i++)folders.add(parts.slice(0,i).join("/"));
    await browserWrite(projectKey(project), {...doc,folders:[...folders]});
    return {success:true};
  }
  if (action === "write") {
    const path=pathOf(args.path),content=args.content;
    if (typeof content!=="string"||new Blob([content]).size>MAX_FILE_BYTES)throw new Error("Text file is too large.");
    const name=path.split("/").pop()||path;
    const next={...doc,files:{...doc.files,[path]:{name,language:name.split(".").pop()||"text",content}}};
    checkSize(next);
    await browserWrite(projectKey(project),next);
    return {success:true};
  }
  if (action === "delete") {
    const path=pathOf(args.path);
    const next={...doc,files:{...doc.files}};
    delete next.files[path];
    await browserWrite(projectKey(project),next);
    return {success:true};
  }
  if (action === "previewEdit" || action === "applyEdit") {
    const path=pathOf(args.path),old=doc.files[path];
    if (!old)throw new Error("File not found.");
    const updated=applyIdeEditsToText(old.content,args.edits);
    const version=String(old.content.length)+":"+old.content;
    if (action==="previewEdit")return {path,original:old.content,updated,version};
    if (args.version!==version)throw new Error("File changed; review the patch again.");
    return browserIde("write",{project,path,content:updated});
  }
  throw new Error("Unsupported virtual IDE operation.");
}
