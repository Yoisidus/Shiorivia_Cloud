"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = function (mod, filename) {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { CLOUD_TAB_LOCK, startSingleTabLease } = require("../src/lib/singleTabLease.ts");

class FakeWebLocks {
  held = false;
  async request(name, options, callback) {
    assert.equal(name, CLOUD_TAB_LOCK);
    assert.equal(options.mode, "exclusive");
    assert.equal(options.ifAvailable, true);
    const granted = !this.held;
    if (granted) this.held = true;
    try { return await callback(granted ? { name, mode: "exclusive" } : null); }
    finally { if (granted) this.held = false; }
  }
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("first tab stays active while a second tab is blocked", async () => {
  const locks = new FakeWebLocks();
  const first = [], second = [];
  const releaseFirst = startSingleTabLease(locks, s => first.push(s));
  await flush();
  assert.deepEqual(first, ["active"]);
  const releaseSecond = startSingleTabLease(locks, s => second.push(s));
  await flush();
  assert.deepEqual(second, ["blocked"]);
  assert.deepEqual(first, ["active"], "new tab must not evict original");
  releaseSecond();
  releaseFirst();
  await flush();
  assert.equal(locks.held, false);
});

test("closing original frees the lock for a manual retry", async () => {
  const locks = new FakeWebLocks();
  const first = startSingleTabLease(locks, () => {});
  await flush();
  const blocked = [];
  startSingleTabLease(locks, s => blocked.push(s))();
  await flush();
  assert.deepEqual(blocked, ["blocked"]);
  first();
  await flush();
  const retried = [];
  const releaseRetry = startSingleTabLease(locks, s => retried.push(s));
  await flush();
  assert.deepEqual(retried, ["active"]);
  releaseRetry();
  await flush();
});

test("cancellation before a delayed lock callback cannot activate a stale page", async () => {
  const locks = new FakeWebLocks();
  const statuses = [];
  const delayed = {
    request: async (name, options, callback) => {
      await new Promise(resolve => setImmediate(resolve));
      return locks.request(name, options, callback);
    },
  };
  const cancel = startSingleTabLease(delayed, s => statuses.push(s));
  cancel();
  await flush();
  await flush();
  assert.deepEqual(statuses, []);
  assert.equal(locks.held, false);
});

test("unsupported Web Locks fails closed; it never runs a second active app", () => {
  const statuses = [];
  const stop = startSingleTabLease(undefined, s => statuses.push(s));
  assert.deepEqual(statuses, ["unsupported"]);
  stop();
});

test("a browser lock error fails closed", async () => {
  const statuses = [];
  startSingleTabLease({request: async () => {throw new Error("Browser denied lock");}}, s => statuses.push(s));
  await flush();
  assert.deepEqual(statuses, ["unsupported"]);
});
