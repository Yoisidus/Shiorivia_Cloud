"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = function loadTs(mod, filename) {
  const source = fs.readFileSync(filename, "utf8");
  mod._compile(ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { checkCloudApiRequest } = require("../src/lib/cloudApiGuard.ts");
const { CloudRequestError, readCloudJson } = require("../src/lib/cloudBody.ts");

function check(method, requestOrigin, site, length, path="/api/chat") {
  return checkCloudApiRequest({
    method, path, requestOrigin, site, length,
    currentOrigin: "https://app.shiorivia.com",
  });
}
test("normal site navigation is unaffected by the former global 503", () => {
  assert.equal(check("GET", null, null, null, "/"), null);
  assert.equal(check("GET", null, null, null, "/api/providers"), null);
});
test("cross-origin API writes and preflights are blocked", () => {
  assert.equal(check("POST", "https://evil.example", "cross-site", null)?.status, 403);
  assert.equal(check("POST", "https://other.shiorivia.com", "same-site", null)?.status, 403);
  assert.equal(check("POST", null, "cross-site", null)?.status, 403);
  assert.equal(check("OPTIONS", "https://evil.example", "cross-site", null)?.status, 405);
});
test("same-origin browser writes work; anonymous non-browser POST is refused", () => {
  assert.equal(check("POST", "https://app.shiorivia.com", "same-origin", null), null);
  assert.equal(check("POST", null, "same-origin", null), null);
  assert.equal(check("POST", null, null, null)?.status, 403);
});
test("declared size limits apply per endpoint", () => {
  assert.equal(check("POST", "https://app.shiorivia.com", "same-origin", "2097153")?.status, 413);
  assert.equal(check("POST", "https://app.shiorivia.com", "same-origin", "262145", "/api/summarize")?.status, 413);
  assert.equal(check("POST", "https://app.shiorivia.com", "same-origin", "131073", "/api/draw")?.status, 413);
});
test("bounded reader accepts UTF-8 JSON objects", async () => {
  const data = { msg: "你好！🌙" };
  const request = new Request("https://app.shiorivia.com/api/chat", {
    method: "POST", body: JSON.stringify(data),
  });
  assert.deepEqual(await readCloudJson(request, 2048), data);
});
test("bounded reader rejects oversized bodies even without a Content-Length header", async () => {
  const large = new Request("https://app.shiorivia.com/api/chat", {
    method: "POST", body: JSON.stringify({ data: "A".repeat(2048) }),
  });
  await assert.rejects(readCloudJson(large, 64), error => error instanceof CloudRequestError && error.status === 413);
});
test("bounded reader rejects malformed and non-object JSON", async () => {
  for (const input of ["{", "[]", "null", "123"]) {
    const request = new Request("https://app.shiorivia.com/api/chat", { method: "POST", body: input });
    await assert.rejects(readCloudJson(request, 1024), error => error instanceof CloudRequestError && error.status === 400);
  }
});
