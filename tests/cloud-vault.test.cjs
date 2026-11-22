"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
// Node 22 already exposes WebCrypto on globalThis.crypto.
require.extensions[".ts"] = function (mod, name) {
  const transpiled = ts.transpileModule(fs.readFileSync(name, "utf8"), {
    fileName: name, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  mod._compile(transpiled, name);
};
const { createCredentialVault, unlockCredentialVault, encryptCredentialVault, isCredentialVaultRecord } =
  require("../src/lib/cloudCredentialVault.ts");
test("AES-GCM vault roundtrips without leaking stored key or passphrase", async () => {
  const credentials = { openrouter: { apiKey: "test-secret-do-not-persist", baseURL: "" } };
  const password = "long-test-passphrase-0001";
  const {record} = await createCredentialVault(password, credentials);
  assert.ok(isCredentialVaultRecord(record));
  assert.ok(!JSON.stringify(record).includes(credentials.openrouter.apiKey));
  assert.ok(!JSON.stringify(record).includes(password));
  assert.deepEqual((await unlockCredentialVault(record, password)).credentials, credentials);
});
test("wrong passphrase cannot decrypt the saved record", async () => {
  const {record} = await createCredentialVault("correct-long-passphrase", {google: {apiKey:"demo-key",baseURL:""}});
  await assert.rejects(unlockCredentialVault(record, "incorrect-long-passphrase"));
});
test("salt and AES-GCM IV change across vault versions and updates", async () => {
  const password = "super-long-example-passphrase";
  const a = await createCredentialVault(password, {});
  const b = await createCredentialVault(password, {});
  assert.notEqual(a.record.salt, b.record.salt);
  const next = await encryptCredentialVault({}, a.key, a.record.salt);
  assert.notEqual(a.record.iv, next.iv);
  assert.notEqual(a.record.ciphertext, next.ciphertext);
  assert.deepEqual((await unlockCredentialVault(next, password)).credentials, {});
});
test("short passphrases and tampered ciphertext fail", async () => {
  await assert.rejects(createCredentialVault("short", {}), /12/);
  const { record } = await createCredentialVault("correct-long-passphrase", {});
  const c = record.ciphertext[0] === "A" ? "B" : "A";
  await assert.rejects(unlockCredentialVault({...record, ciphertext: c + record.ciphertext.slice(1)}, "correct-long-passphrase"));
});

test("encrypted vault writes reject stale tabs and never expose plaintext in IndexedDB", async () => {
  const { indexedDB } = require("fake-indexeddb");
  global.indexedDB = indexedDB;
  const { browserRead, browserWrite, browserMutate } = require("../src/lib/browserStore.ts");
  const record1 = await createCredentialVault("long-vault-passphrase-001", {
    openrouter: { apiKey: "key-a-secret-0001", baseURL: "" },
  });
  await browserWrite("cloud:byok", record1.record);
  const firstSeen = await browserRead("cloud:byok", null);
  assert.ok(!JSON.stringify(firstSeen).includes("key-a-secret-0001"));
  const second = await encryptCredentialVault({
    openrouter: { apiKey: "key-b-secret-0002", baseURL: "" },
  }, record1.key, record1.record.salt);
  await browserMutate("cloud:byok", current => {
    assert.equal(current.ciphertext, record1.record.ciphertext);
    return second;
  });
  await assert.rejects(browserMutate("cloud:byok", current => {
    if (current.ciphertext !== record1.record.ciphertext) throw new Error("Vault changed in another tab.");
    return record1.record;
  }), /changed/i);
  const saved = await browserRead("cloud:byok", null);
  assert.equal(saved.ciphertext, second.ciphertext);
  assert.equal((await unlockCredentialVault(saved, "long-vault-passphrase-001")).credentials.openrouter.apiKey,
    "key-b-secret-0002");
});
