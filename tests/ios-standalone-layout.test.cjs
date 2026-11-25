const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("installed app uses an opaque native status bar and device viewport", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /statusBarStyle: "black"/);
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
