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

test("VIAE timeline preview uses English labels and English stage copy", () => {
  const worldline = { ...worldlineFor(null), era: "高一春夏季", period: "T-5-6" };
  const english = describeStoryWorldline(worldline, "en");
  assert.match(english, /Canon/);
  assert.match(english, /First high-school year/);
  assert.match(english, /T-5-6/);
  assert.doesNotMatch(english, /原作|基准|高一春夏季/);
});

test("older built-in timeline previews lacking English copy still translate", () => {
  const worldline = {
    ...worldlineFor(null),
    era: "高一春夏季",
    period: "T-5-6",
    canonTimeline: BANG_DREAM_CANON.map(stage => ({era:stage.era, period:stage.period})),
  };
  const before = JSON.stringify(worldline);
  assert.match(describeStoryWorldline(worldline, "en"), /MyGO!!!!!|Reunited|First high-school year/);
  assert.doesNotMatch(describeStoryWorldline(worldline, "en"), /高一春夏季|原作/);
  assert.equal(JSON.stringify(worldline), before);
});

test("AU baseline label is translated without changing the timeline ID", () => {
  const worldline = {
    ...worldlineFor(null), kind:"au",
    era:"Another path", period:"AU-1",
    baseEra:"高一春夏季", basePeriod:"T-5-6",
  };
  const english = describeStoryWorldline(worldline, "en");
  assert.match(english, /Baseline/);
  assert.match(english, /First high-school year/);
  assert.doesNotMatch(english, /基准/);
});

test("story and novel cast picker localizes built-in names without changing IDs or custom names", () => {
  const source = fs.readFileSync(require("node:path").join(__dirname, "..", "src/components/StoryCastPicker.tsx"), "utf8");
  const { characterDisplayName, CHARACTER_NAMES } = require("../src/lib/characterNames.ts");
  assert.ok(source.startsWith('"use client";'));
  assert.ok(source.includes('id: char.id, name: characterDisplayName(char.id, char.name, locale)'));
  assert.ok(source.includes('id: char.id, name: nameForCharta(char, locale)'));
  assert.ok(source.includes('[customCharacters, locale]'));
  assert.ok(source.includes('catalog.find(char => char.id === id)?.name'));
  for (const [id, names] of Object.entries(CHARACTER_NAMES)) {
    for (const [locale, expected] of [["zh-CN", names.zh], ["zh-TW", names.ja], ["en", names.romanized], ["ja", names.ja], ["ko", names.romanized]]) {
      assert.equal(characterDisplayName(id, names.zh, locale), expected);
    }
  }
  assert.equal(characterDisplayName("custom-cast-id", "原创角色", "en"), "原创角色");
});
