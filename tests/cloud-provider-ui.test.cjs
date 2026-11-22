"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}
  }).outputText, filename
);
const {DEFAULT_LOCAL_PROVIDERS, getVisibleLocalProviders} = require("../src/lib/localProviders.ts");
const {playlistParts, playlistKey, musicFolderTree, playlistDisplayName, inPlaylist} =
  require("../src/lib/musicPlaylists.ts");

test("without decrypted BYOK keys, no configured text provider is visible", () => {
  assert.deepEqual(getVisibleLocalProviders(DEFAULT_LOCAL_PROVIDERS, []), []);
  const openrouter = DEFAULT_LOCAL_PROVIDERS.map(p => ({
    ...p, configured:p.id === "openrouter"
  }));
  assert.deepEqual(getVisibleLocalProviders(openrouter, []).map(p=>p.id), ["openrouter"]);
  assert.deepEqual(getVisibleLocalProviders(openrouter, ["openrouter"]), []);
});

test("browser model UI does not present model fallbacks for an inactive provider", () => {
  const page = fs.readFileSync("src/app/page.tsx", "utf8");
  const sidebar = fs.readFileSync("src/components/SidebarLeft.tsx", "utf8");
  const settings = fs.readFileSync("src/components/SettingsCenter.tsx", "utf8");
  assert.match(page, /effectiveApiProvider = visibleProviders\.some\(p => p\.id === apiProvider\) \? apiProvider : ""/);
  assert.match(page, /apiProvider=\{effectiveApiProvider\}/);
  assert.match(page, /activeProvider=\{effectiveApiProvider\}/);
  assert.match(page, /apiProvider: effectiveApiProvider, cloudCredentials/);
  assert.match(sidebar, /if \(!hasUsableProvider \|\| apiProvider\.startsWith\("custom_"\)\) return/);
  assert.match(sidebar, /hasUsableProvider && !apiProvider\.startsWith\("custom_"\) && modelGroups\.map/);
  assert.match(settings, /provider\.configured && provider\.id !== "fal" && activeProvider === provider\.id/);
});

test("built-in playlist uses localized labels without changing key or selection", () => {
  const builtIn = {id:"silence",name:"Demo"};
  const local = {id:"local_123",name:"Song",playlistPath:["Anime","Favorites"]};
  assert.deepEqual(playlistParts(builtIn),["内置曲库"]);
  assert.equal(playlistKey(playlistParts(builtIn)),"内置曲库");
  assert.equal(inPlaylist(builtIn,"内置曲库"),true);
  assert.equal(inPlaylist(builtIn,"Built-in library"),false);
  assert.deepEqual(playlistParts(local),["本地音乐","Anime","Favorites"]);
  const roots = musicFolderTree([builtIn,local]);
  const folder = roots.find(item=>item.key==="内置曲库");
  assert.ok(folder);
  const labels = [
    ["zh-CN","内置曲库"],["zh-TW","內建曲庫"],["en","Built-in library"],
    ["ja","内蔵ライブラリ"],["ko","내장 음악 라이브러리"]
  ];
  for(const [locale,label] of labels) {
    assert.equal(playlistDisplayName(folder,locale),label);
  }
  assert.equal(folder.key,"内置曲库");
  assert.equal(playlistDisplayName({key:"本地音乐/Anime",name:"Anime"},"en"),"Anime");
});
