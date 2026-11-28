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

test("Tela chapter numbering preserves intentionally empty English suffix", () => {
  const { deepText, novelChapterLabel } = require("../src/lib/i18nDeep.ts");
  assert.equal(deepText("en", "novel.toolbar.chapterSuffix"), "");
  for (const [locale, expected] of [["zh-CN", "第1章"], ["zh-TW", "第1章"], ["en", "Chapter 1"], ["ja", "第1章"], ["ko", "제1장"]]) {
    assert.equal(novelChapterLabel(locale, 1), expected);
  }
  assert.equal(novelChapterLabel("en", 12), "Chapter 12");
  assert.equal(deepText("en", "missing.test.key"), "missing.test.key");
  const readSource = p => fs.readFileSync(require("node:path").join(__dirname, "..", p), "utf8");
  const ui = readSource("src/components/NovelInterface.tsx");
  assert.equal((ui.match(/novelChapterLabel\(locale, i \+ 1\)/g) || []).length, 3);
  assert.ok(readSource("src/hooks/useChatEngine.ts").includes("previousTitle || novelChapterLabel(locale, chapterCount)"));
  assert.ok(readSource("src/components/NovelArchiveActions.tsx").includes("extractNovelChapters(session.messages, locale)"));
  assert.ok(readSource("src/lib/novelDocx.ts").includes("meta?.[1]?.trim() || novelChapterLabel(locale, index + 1)"));
});

test("DOCX fallback chapter titles use the current locale and preserve authored titles", () => {
  const { extractNovelChapters } = require("../src/lib/novelDocx.ts");
  const messages = [
    {role:"assistant", content:"First chapter prose."},
    {role:"assistant", content:'<meta title="Novel" chapter="A chosen title" />\nSecond chapter prose.'}
  ];
  const before = JSON.stringify(messages);
  assert.deepEqual(extractNovelChapters(messages, "en").map(ch => ch.title), ["Chapter 1", "A chosen title"]);
  assert.deepEqual(extractNovelChapters(messages, "ja").map(ch => ch.title), ["第1章", "A chosen title"]);
  assert.equal(JSON.stringify(messages), before);
});

test("composer placeholders use localized character names and natural word order", () => {
  const { chatComposerPlaceholder } = require("../src/lib/i18nDeep.ts");
  const { characterDisplayName } = require("../src/lib/characterNames.ts");
  const cases = [
    ["zh-CN", "和千早 爱音聊聊天…"],
    ["zh-TW", "和千早 愛音聊聊天…"],
    ["en", "Chat with Chihaya Anon…"],
    ["ja", "千早 愛音とおしゃべり…"],
    ["ko", "Chihaya Anon에게 메시지 보내기…"],
  ];
  for (const [locale, expected] of cases) {
    const name = characterDisplayName("anon", "千早 爱音", locale);
    assert.equal(chatComposerPlaceholder(locale, "chat", name), expected);
    assert.ok(!chatComposerPlaceholder(locale, "infinite", name).includes("{name}"));
    assert.ok(!chatComposerPlaceholder(locale, "sliding", name).includes(name));
  }
  assert.equal(chatComposerPlaceholder("en", "infinite", characterDisplayName("uika", "三角 初华", "en")), "Speak to Misumi Uika…");
  assert.equal(chatComposerPlaceholder("en", "chat", characterDisplayName("custom-id", "OC $&", "en")), "Chat with OC $&…");
  assert.equal(chatComposerPlaceholder("en", "sliding", ""), "Start your dream…");
  const source = fs.readFileSync(require("node:path").join(__dirname, "..", "src/components/ChatInterface.tsx"), "utf8");
  assert.ok(source.startsWith('"use client";'));
  assert.ok(source.includes("chatComposerPlaceholder(locale, currentSession?.memoryMode, characterDisplayName(currentCharacter.id, currentCharacter.name, locale))"));
  assert.ok(source.includes('storyStateRepairing ? deepText(locale, "chat.waitRepair")'));
});
