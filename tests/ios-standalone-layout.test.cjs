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

test("browser chrome follows the active mode and story/character theme", () => {
  const { browserChromeColor } = require("../src/lib/browserChromeTheme.ts");
  const color = (mode, theme = "sky", hex = "#483d8b", assigned = true) => browserChromeColor(mode, theme, hex, assigned);
  assert.equal(color("hub"), "#f6f8f7");
  assert.equal(color("charta"), "#f7f8f5");
  assert.equal(color("lime"), "#fafaf9");
  assert.equal(color("novel"), "#fdf6e3");
  assert.deepEqual(["sky", "sage", "rose"].map(theme => color("sliding", theme)), ["#e0f2fe", "#b7d3b0", "#f4c6d2"]);
  assert.equal(color("infinite", "sky", "#123456", false), "#dce4e9");
  assert.equal(color("chat", "sky", "#123456", false), "#f3f7f4");
  assert.notEqual(color("chat"), color("chat", "sky", "#779977"));
  assert.match(color("chat"), /^#[0-9a-f]{6}$/);
  assert.equal(color("chat", "sky", "invalid"), "#dce4e9");
  const page = read("src/app/page.tsx");
  const css = read("src/app/globals.css");
  const layout = read("src/app/layout.tsx");
  assert.ok(page.includes('style.setProperty("--app-edge-color", edgeColor)'));
  assert.ok(page.includes('setAttribute("content", edgeColor)'));
  assert.ok(page.includes("}, [edgeColor])"));
  assert.ok(css.includes("background-color: var(--app-edge-color, #f6f8f7)"));
  assert.ok(layout.includes('className="ios-browser-bottom-edge-sample"'));
  assert.ok(css.includes(".ios-browser-bottom-edge-sample { inset: auto 0 0; }"));
  assert.match(layout, /themeColor: "#f6f8f7"/);
  assert.equal(JSON.parse(read("public/manifest.json")).theme_color, "#f6f8f7");
});
