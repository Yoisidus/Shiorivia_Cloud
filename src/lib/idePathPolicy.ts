/** Shared pure path policy for the local Officina IDE sandbox. */
const MAX_DEPTH = 14;
// Hide sensitive files and directories from EVERY IDE entrypoint: tree, search, read, snapshot and writes.
// This is a filename/path boundary, not a guarantee against secrets embedded in ordinary source files.
const BLOCKED_PARTS = /^(?:node_modules|\.git|\.next|\.env(?:\..*)?|\.ssh|\.aws|\.azure|\.npmrc|\.gitconfig|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|credentials?(?:[-_.].*)?|secrets?(?:[-_.].*)?|tokens?(?:[-_.].*)?|private[-_.]?key(?:[-_.].*)?|api[-_.]?keys?(?:[-_.].*)?|(?:access|refresh|auth)[-_.]?tokens?(?:[-_.].*)?|(?:service[-_.]?account|client[-_.]?secret)(?:[-_.].*)?|.*[-_.](?:credentials?|secrets?|private[-_.]?key|api[-_.]?keys?|client[-_.]?secret|service[-_.]?account|access[-_.]?token|refresh[-_.]?token)(?:[-_.].*)?)$/i;
const BLOCKED_EXT = /\.(?:pem|p8|p12|pfx|p7b|key|crt|cer|der|jks|keystore|kdbx|asc|gpg|ovpn|sqlite3?|db|png|jpe?g|gif|webp|ico|pdf|zip|gz|7z|exe|dll|so|wasm|mp3|mp4|woff2?)$/i;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function cleanPart(part: string): string {
  if (!part || part !== part.trim() || part === "." || part === ".."
    || ["__proto__", "prototype", "constructor", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"].includes(part)
    || part.startsWith(".") || part.endsWith(".") || /[<>:"\\|?*\x00-\x1f]/.test(part)
    || BLOCKED_PARTS.test(part) || WINDOWS_RESERVED.test(part)
    || part.length > 100) throw new Error("不允许访问该项目路径或隐藏文件。");
  return part;
}
export function validProjectName(value: unknown): string {
  if (typeof value !== "string" || value.includes("/") || value.includes("\\"))
    throw new Error("项目名称只能是一个文件夹名称。");
  return cleanPart(value);
}
export function validRelativePath(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 500 || value.startsWith("/")
    || value.includes("\\") || value.includes("//"))
    throw new Error("项目文件路径无效。");
  const parts = value.split("/");
  if (parts.length > MAX_DEPTH) throw new Error("项目目录层级过深。");
  for (const part of parts) cleanPart(part);
  return parts.join("/");
}
export function isWorkspaceTextFile(relative: string): boolean {
  // Also validate here: callers that forget to validate the path still cannot expose keys.
  try { validRelativePath(relative); } catch { return false; }
  return !BLOCKED_EXT.test(relative);
}
