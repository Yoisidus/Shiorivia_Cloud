"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = function(mod, filename) {
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  mod._compile(js, filename);
};
const { BANG_DREAM_WORLD_ID, BANG_DREAM_CANON, worldlineFor, displayWorldlineEra, describeStoryWorldline } =
  require("../src/lib/storyWorldline.ts");

test("BanG Dream! era display is translated in all five UI locales", () => {
  const cases = [
    ["zh-CN", "高一春夏季"],
    ["zh-TW", "高一春夏"],
    ["en", "First high-school year · spring/summer"],
    ["ja", "高校1年 · 春夏"],
    ["ko", "고등학교 1학년 · 봄/여름"],
  ];
  for (const [locale, expected] of cases) {
    assert.equal(displayWorldlineEra(BANG_DREAM_WORLD_ID, "高一春夏季", locale), expected);
  }
});
test("timeline IDs are never translated or rewritten", () => {
  assert.equal(BANG_DREAM_CANON[5].era, "高一春夏季");
  assert.equal(BANG_DREAM_CANON[5].period, "T-5-6");
  assert.equal(displayWorldlineEra("world-custom", "高一春夏季", "en"), "高一春夏季");
  assert.equal(displayWorldlineEra(BANG_DREAM_WORLD_ID, "custom era", "en"), "custom era");
});
test("worldline display localizes the era without changing data", () => {
  const worldline = { ...worldlineFor(null), era: "高一春夏季", period: "T-5-6" };
  const before = JSON.stringify(worldline);
  assert.match(describeStoryWorldline(worldline, "en"), /First high-school year/);
  assert.match(describeStoryWorldline(worldline, "ja"), /高校1年/);
  assert.equal(JSON.stringify(worldline), before);
});
