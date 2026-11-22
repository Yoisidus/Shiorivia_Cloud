"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
global.crypto = require("node:crypto").webcrypto;
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
