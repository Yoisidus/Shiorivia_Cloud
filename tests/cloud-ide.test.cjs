"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const zlib = require("node:zlib");
const ts = require("typescript");
const { indexedDB } = require("fake-indexeddb");

require.extensions[".ts"] = function loadTypeScript(mod, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  mod._compile(output, filename);
};

global.indexedDB = indexedDB;
global.BroadcastChannel = undefined; // deterministic tests, no open cross-tab handles
global.window = new EventTarget();
if (typeof global.CustomEvent === "undefined") {
  global.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this.detail = options.detail;
    }
  };
}
const { browserIde } = require("../src/lib/browserIde.ts");
const { projectZip } = require("../src/lib/ideProjectZip.ts");
const { subscribeBrowserChanges } = require("../src/lib/browserStore.ts");
let serial = 0;
const projectName = () => "cloud-validation-" + ++serial;

async function newProject() {
  const project = projectName();
  await browserIde("createProject", { name: project });
  return project;
}
async function save(project, name, content, previous = null) {
  return browserIde("writeBatch", {
    project, files: { [name]: content }, expected: { [name]: previous }
  });
}

/** Read the ZIP central directory and extract using native Node zlib. */
async function extractZip(blob) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, "ZIP end directory exists");
  const count = buffer.readUInt16LE(eocd + 10);
  const centralStart = buffer.readUInt32LE(eocd + 16);
  let offset = centralStart;
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const length = buffer.readUInt16LE(offset + 28);
    const extra = buffer.readUInt16LE(offset + 30);
    const comment = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + length).toString("utf8");
    const localOffset = buffer.readUInt32LE(offset + 42);
    assert.equal(buffer.readUInt32LE(localOffset), 0x04034b50);
    const localLength = buffer.readUInt16LE(localOffset + 26);
    const localExtra = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localLength + localExtra;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 8 ? zlib.inflateRawSync(data) : data);
    assert.ok(method === 0 || method === 8);
    offset += 46 + length + extra + comment;
  }
  return entries;
}

test("project creation is idempotent and project listing reflects actual storage", async () => {
  const project = await newProject();
  await browserIde("createProject", { name: project });
  await save(project, "src/main.ts", "one");
  await browserIde("createProject", { name: project });
  const listed = await browserIde("projects");
  assert.ok(listed.projects.includes(project));
  assert.equal((await browserIde("snapshot", { project })).files["src/main.ts"].content, "one");
});

test("stale writes from two tabs cannot overwrite each other", async () => {
  const project = await newProject();
  await save(project, "main.ts", "base");
  const candidates = ["tab-one", "tab-two"];
  const settled = await Promise.allSettled(candidates.map(value => save(project, "main.ts", value, "base")));
  assert.equal(settled.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(settled.filter(x => x.status === "rejected").length, 1);
  const content = (await browserIde("snapshot", { project })).files["main.ts"].content;
  assert.ok(candidates.includes(content));
});

test("two non-conflicting writes preserve both files", async () => {
  const project = await newProject();
  await Promise.all([
    save(project, "a.ts", "alpha"),
    save(project, "b.ts", "beta")
  ]);
  const files = (await browserIde("snapshot", { project })).files;
  assert.equal(files["a.ts"].content, "alpha");
  assert.equal(files["b.ts"].content, "beta");
});

test("a stale multi-file save fails completely", async () => {
  const project = await newProject();
  await browserIde("writeBatch", { project, files: { "a.ts": "a0", "b.ts": "b0" }, expected: { "a.ts": null, "b.ts": null } });
  await save(project, "b.ts", "b1", "b0");
  await assert.rejects(browserIde("writeBatch", {
    project, files: { "a.ts": "a1", "b.ts": "b2" }, expected: { "a.ts": "a0", "b.ts": "b0" }
  }), /changed/i);
  const files = (await browserIde("snapshot", { project })).files;
  assert.equal(files["a.ts"].content, "a0");
  assert.equal(files["b.ts"].content, "b1");
});

test("reviewed multi-file AI patches are atomic", async () => {
  const project = await newProject();
  await browserIde("writeBatch", { project, files: { "a.ts": "first", "b.ts": "second" }, expected: { "a.ts": null, "b.ts": null } });
  const operation = old => [{ op: "replace", startLine: 1, expected: old, text: "changed" }];
  const previewA = await browserIde("previewEdit", { project, path: "a.ts", edits: operation("first") });
  const previewB = await browserIde("previewEdit", { project, path: "b.ts", edits: operation("second") });
  await save(project, "b.ts", "elsewhere", "second");
  await assert.rejects(browserIde("applyEditsBatch", { project, files: [
    { path: "a.ts", version: previewA.version, edits: operation("first") },
    { path: "b.ts", version: previewB.version, edits: operation("second") }
  ] }), /changed/i);
  let files = (await browserIde("snapshot", { project })).files;
  assert.equal(files["a.ts"].content, "first");
  assert.equal(files["b.ts"].content, "elsewhere");
  const fresh = await browserIde("previewEdit", { project, path: "b.ts", edits: operation("elsewhere") });
  await browserIde("applyEditsBatch", { project, files: [
    { path: "a.ts", version: previewA.version, edits: operation("first") },
    { path: "b.ts", version: fresh.version, edits: operation("elsewhere") }
  ] });
  files = (await browserIde("snapshot", { project })).files;
  assert.equal(files["a.ts"].content, "changed");
  assert.equal(files["b.ts"].content, "changed");
});

test("AI project creation plus all approved files is one commit", async () => {
  const project = projectName();
  await assert.rejects(browserIde("writeBatch", {
    project, create: true, files: { "a.ts": "okay", "b.ts": "x".repeat(256 * 1024 + 1) },
    expected: { "a.ts": null, "b.ts": null }
  }), /large/i);
  assert.ok(!(await browserIde("projects")).projects.includes(project));
  await browserIde("writeBatch", {
    project, create: true, files: { "src/a.ts": "okay", "docs/说明.md": "你好" },
    expected: { "src/a.ts": null, "docs/说明.md": null }
  });
  assert.ok((await browserIde("projects")).projects.includes(project));
  await assert.rejects(browserIde("writeBatch", {
    project, create: true, files: { "src/a.ts": "overwrite" }, expected: { "src/a.ts": "okay" }
  }), /created/i);
});

test("file/folder collision and protected paths are rejected", async () => {
  const project = await newProject();
  await save(project, "src.ts", "source");
  await assert.rejects(browserIde("createFolder", { project, path: "src.ts/nested" }), /file cannot also be a (directory|parent directory)/i);
  await assert.rejects(save(project, "src.ts/inner.ts", "inner"), /parent directory/i);
  await assert.rejects(save(project, ".env", "secret"), /path|hidden/i);
  await assert.rejects(save(project, "__proto__", "not a file"), /path|hidden/i);
});

test("same-tab change notification only fires after committed writes", async () => {
  const project = await newProject();
  let notifications = 0;
  const unsubscribe = subscribeBrowserChanges("ide:project:" + project, () => { notifications++; });
  await save(project, "a.ts", "first");
  assert.equal(notifications, 1);
  await assert.rejects(save(project, "a.ts", "stale", "wrong"), /changed/i);
  assert.equal(notifications, 1);
  unsubscribe();
});

test("ZIP export keeps UTF-8 files and empty nested directories", async () => {
  const project = await newProject();
  await browserIde("createFolder", { project, path: "empty/deeper" });
  await browserIde("writeBatch", {
    project, files: { "src/main.ts": "export const foo = 42;\n", "docs/说明.md": "你好，Shiorivia 🌙" },
    expected: { "src/main.ts": null, "docs/说明.md": null }
  });
  const snapshot = await browserIde("snapshot", { project });
  const archive = await extractZip(await projectZip(project, snapshot.files, snapshot.entries));
  assert.ok(archive.has(project + "/"));
  assert.ok(archive.has(project + "/empty/deeper/"));
  assert.equal(archive.get(project + "/src/main.ts").toString("utf8"), "export const foo = 42;\n");
  assert.equal(archive.get(project + "/docs/说明.md").toString("utf8"), "你好，Shiorivia 🌙");
});

test("project count and file byte limits are checked without partial saves", async () => {
  const project = await newProject();
  const original = await browserIde("snapshot", { project });
  const files = {}, expected = {};
  for (let i = 0; i < 501; i++) {
    files["file-" + i + ".ts"] = "small";
    expected["file-" + i + ".ts"] = null;
  }
  await assert.rejects(browserIde("writeBatch", { project, files, expected }), /count/i);
  const current = await browserIde("snapshot", { project });
  assert.deepEqual(current.files, original.files);
});
