const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("installed app leaves the native status bar color to WebKit and uses the device viewport", () => {
  const layout = read("src/app/layout.tsx");
  assert.doesNotMatch(layout, /statusBarStyle\s*:/);
  assert.doesNotMatch(layout, /["']apple-mobile-web-app-status-bar-style["']/);
  assert.match(layout, /"apple-mobile-web-app-capable": "yes"/);
  assert.match(layout, /viewportFit: "cover"/);
});
test("phone settings keep safe gutters, bounded height and an independently scrollable content pane", () => {
  const css = read("src/app/globals.css");
  const settings = read("src/components/SettingsCenter.tsx");
  assert.match(css, /@media \(max-width: 767px\)/);
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.ok(css.includes("env(safe-area-inset-" + edge + ", 0px)"));
  }
  assert.ok(css.includes("max-height: min(680px, 82dvh, 100%)"));
  assert.match(settings, /settings-overlay fixed inset-0/);
  assert.match(settings, /settings-panel flex/);
  assert.match(settings, /settings-scroll min-h-0 flex-1 overflow-y-auto/);
});
test("standalone hub, VIAE, Charta and chat use explicit viewport treatment", () => {
  for (const name of ["ModeHub", "ViaeInterface", "ChartaInterface"]) {
    assert.ok(read("src/components/" + name + ".tsx").includes("standalone-safe-screen"));
  }
  assert.ok(read("src/app/page.tsx").includes("standalone-workspace"));
  assert.match(read("src/app/globals.css"), /@media \(display-mode: standalone\) and \(max-width: 767px\)/);
});

test("iOS standalone top-edge sample is nonpainting and noninteractive", () => {
  const layout = read("src/app/layout.tsx");
  const css = read("src/app/globals.css");
  assert.ok(layout.includes('<div className="ios-standalone-edge-sample" aria-hidden="true" />'));
  assert.ok(css.includes(".ios-standalone-edge-sample { display: none; }"));
  const sample = css.slice(css.indexOf("@supports (-webkit-touch-callout: none)"));
  for (const rule of ["position: fixed", "height: 12px", "pointer-events: none", "background-clip: text"]) {
    assert.ok(sample.includes(rule));
  }
  assert.ok(css.includes("@supports (-webkit-touch-callout: none)"));
});

test("browser chrome follows the actual adjacent surfaces, not story or character accents", () => {
  const { browserChromeEdges, applyBrowserChromeEdges } = require("../src/lib/browserChromeTheme.ts");
  const both = color => ({ top: color, bottom: color });
  for (const mode of ["infinite", "sliding", "chat"]) {
    assert.deepEqual(browserChromeEdges(mode), both("#ffffff"));
  }
  assert.deepEqual(browserChromeEdges("novel"), both("#fdf6e3"));
  assert.deepEqual(browserChromeEdges("hub"), both("#f6f8f7"));
  assert.deepEqual(browserChromeEdges("charta"), both("#f7f8f5"));
  assert.deepEqual(browserChromeEdges("lime", "directory"), { top: "#ffffff", bottom: "#152841" });
  assert.deepEqual(browserChromeEdges("lime", "create"), { top: "#ffffff", bottom: "#fcfcfb" });
  assert.deepEqual(browserChromeEdges("lime", "conversation"), both("#ffffff"));
  const properties = {};
  let meta;
  const fakeDocument = {
    documentElement: { style: { setProperty: (key, value) => { properties[key] = value; } } },
    querySelector: selector => {
      assert.equal(selector, 'meta[name="theme-color"]');
      return { setAttribute: (key, value) => { assert.equal(key, "content"); meta = value; } };
    },
  };
  applyBrowserChromeEdges(fakeDocument, browserChromeEdges("lime", "directory"));
  assert.equal(properties["--app-edge-color"], "#ffffff");
  assert.equal(properties["--app-bottom-edge-color"], "#152841");
  assert.equal(meta, "#ffffff");
  applyBrowserChromeEdges(fakeDocument, browserChromeEdges("novel"));
  assert.equal(properties["--app-edge-color"], "#fdf6e3");
  assert.equal(properties["--app-bottom-edge-color"], "#fdf6e3");
  assert.equal(meta, "#fdf6e3");
  const page = read("src/app/page.tsx");
  const css = read("src/app/globals.css");
  const layout = read("src/app/layout.tsx");
  const chat = read("src/components/ChatInterface.tsx");
  const viae = read("src/components/ViaeInterface.tsx");
  assert.ok(page.includes('if (edgeMode !== "lime") applyBrowserChromeEdges(document, browserChromeEdges(edgeMode))'));
  assert.ok(viae.includes('applyBrowserChromeEdges(document, browserChromeEdges("lime", edgeView))'));
  assert.ok(viae.includes("viae-edge-surface"));
  assert.ok(chat.includes("bg-white md:bg-white/80 md:backdrop-blur"));
  assert.ok(chat.includes("bg-white md:bg-white/50 md:backdrop-blur-sm"));
  assert.ok(css.includes("background-color: var(--app-edge-color, #f6f8f7)"));
  assert.ok(css.includes("background-color: var(--app-bottom-edge-color, var(--app-edge-color, #f6f8f7))"));
  assert.ok(layout.includes('className="ios-browser-bottom-edge-sample"'));
  assert.match(layout, /themeColor: "#f6f8f7"/);
  assert.equal(JSON.parse(read("public/manifest.json")).theme_color, "#f6f8f7");
});
