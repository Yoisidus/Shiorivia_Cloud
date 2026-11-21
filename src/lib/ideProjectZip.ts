import type { CodeFile } from "../types";
import { validProjectName, validRelativePath, isWorkspaceTextFile } from "./idePathPolicy";

/**
 * Create a standards-compatible ZIP entirely in the browser.
 * Uses native deflate-raw compression when available; otherwise ZIP STORE.
 * Never uploads files, follows symlinks, or includes protected paths.
 */
type Entry = { name: string; data: Uint8Array; directory: boolean };
type TreeEntry = { path: string; type: "file" | "directory" };
const encoder = new TextEncoder();
const MAX_FILE_BYTES = 256 * 1024;
const MAX_PROJECT_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 500;
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < CRC_TABLE.length; n++) {
  let c = n;
  for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function compress(data: Uint8Array): Promise<{bytes: Uint8Array; method: number}> {
  if (data.length < 60 || typeof CompressionStream === "undefined")
    return {bytes:data,method:0};
  try {
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw" as any));
    const output = new Uint8Array(await new Response(stream).arrayBuffer());
    if (output.length < data.length) return {bytes:output,method:8};
  } catch { /* Older browsers support only uncompressed ZIP entries. */ }
  return {bytes:data,method:0};
}
function folderPaths(path: string): string[] {
  const parts = path.split("/");
  return parts.slice(1).map((_,i) => parts.slice(0,i+1).join("/") + "/");
}
export async function projectZip(
  rawProject: string,
  files: Record<string,CodeFile>,
  tree: TreeEntry[],
): Promise<Blob> {
  const project = validProjectName(rawProject);
  const fileEntries = Object.entries(files);
  if (fileEntries.length > MAX_FILES) throw new Error("Too many files to export.");
  const dirs = new Set<string>([project + "/"]);
  const entries: Entry[] = [];
  let totalBytes = 0;
  for (const item of tree) {
    if (item.type !== "directory") continue;
    const path = validRelativePath(item.path);
    for (const folder of folderPaths(project + "/" + path)) dirs.add(folder);
    dirs.add(project + "/" + path + "/");
  }
  for (const [rawPath,file] of fileEntries) {
    const path = validRelativePath(rawPath);
    if (!isWorkspaceTextFile(path) || typeof file?.content !== "string")
      throw new Error("Project contains an unsupported text/code path.");
    const data = encoder.encode(file.content);
    if (data.length > MAX_FILE_BYTES) throw new Error("Project file exceeds the browser IDE limit.");
    totalBytes += data.length;
    if (totalBytes > MAX_PROJECT_BYTES) throw new Error("Project exceeds the 5 MiB export limit.");
    for (const folder of folderPaths(project + "/" + path)) dirs.add(folder);
    entries.push({name:project + "/" + path,data,directory:false});
  }
  const fullEntries: Entry[] = [
    ...[...dirs].sort().map(name=>({name,data:new Uint8Array(0),directory:true})),
    ...entries.sort((a,b)=>a.name.localeCompare(b.name)),
  ];
  if (fullEntries.length > 65535) throw new Error("Too many archive entries.");
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let localSize = 0;
  let centralSize = 0;
  for (const entry of fullEntries) {
    const name = encoder.encode(entry.name);
    if (name.length > 65535) throw new Error("File path is too long for ZIP.");
    const result = entry.directory ? {bytes:entry.data,method:0} : await compress(entry.data);
    const crc = crc32(entry.data);
    const offset = localSize;
    const local = new Uint8Array(30 + name.length);
    const lh = new DataView(local.buffer);
    lh.setUint32(0,0x04034b50,true);
    lh.setUint16(4,20,true);
    lh.setUint16(6,0x0800,true); // UTF-8 names
    lh.setUint16(8,result.method,true);
    lh.setUint16(12,0x0021,true); // 1980-01-01
    lh.setUint32(14,crc,true);
    lh.setUint32(18,result.bytes.length,true);
    lh.setUint32(22,entry.data.length,true);
    lh.setUint16(26,name.length,true);
    local.set(name,30);
    localParts.push(local,result.bytes);
    localSize += local.length + result.bytes.length;
    const central = new Uint8Array(46 + name.length);
    const ch = new DataView(central.buffer);
    ch.setUint32(0,0x02014b50,true);
    ch.setUint16(4,20,true);
    ch.setUint16(6,20,true);
    ch.setUint16(8,0x0800,true);
    ch.setUint16(10,result.method,true);
    ch.setUint16(14,0x0021,true);
    ch.setUint32(16,crc,true);
    ch.setUint32(20,result.bytes.length,true);
    ch.setUint32(24,entry.data.length,true);
    ch.setUint16(28,name.length,true);
    ch.setUint32(38,entry.directory ? (0x10 << 16) : 0,true);
    ch.setUint32(42,offset,true);
    central.set(name,46);
    centralParts.push(central);
    centralSize += central.length;
  }
  const footer = new Uint8Array(22);
  const end = new DataView(footer.buffer);
  end.setUint32(0,0x06054b50,true);
  end.setUint16(8,fullEntries.length,true);
  end.setUint16(10,fullEntries.length,true);
  end.setUint32(12,centralSize,true);
  end.setUint32(16,localSize,true);
  return new Blob([...localParts,...centralParts,footer],{type:"application/zip"});
}
