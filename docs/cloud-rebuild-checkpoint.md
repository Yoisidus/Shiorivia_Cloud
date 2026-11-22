> **Historical archive / 历史存档（2026-11-21）**: This document records the former `rebuild/local-foundation` phase and its *then-current* HTTP 503 staging guard. Those temporary branches were retired; Cloud now runs from `dev → main`, with public beta accessible at [app.shiorivia.com](https://app.shiorivia.com). Statements below are historical and **not current setup or security guidance**. For current behavior see [Cloud docs](README.md), [security](cloud-browser-security.md) and [README](../README.md).

# Cloud rebuild checkpoint — 2026-11-21

This is an **engineering checkpoint**, not the Cloud release.

- Source: `Yoisidus/Shiorivia` `c9ba70d7e4e3660af747c44fa0bc148c9c023d15`.
- Destination: `Yoisidus/Shiorivia_Cloud`, branch `rebuild/local-foundation`.
- Rollback: `archive/cloud-before-local-rebuild-2026-11-21` points to original Cloud `main` `29a4d421408d4a837f7b927815d5ec876fe09fd3`.
- Production: Vercel `shiorivia_cloud`, `app.shiorivia.com`, connected to old `main`; unchanged in this checkpoint.
- Imported: Local source files, docs, project configuration, and shared text assets; README is replaced with this staging note.
- Kept temporarily from old Cloud: `public/music/demo.mp3`, `public/shiorivia-app-icon.png`, `public/shiorivia-favicon-32.png`, `public/shiorivia-og.png`; replace with actual Local-licensed assets or fresh Cloud assets before release.
- Not copied: Cloud legacy Python function `api/run_cloud.py`; the new tree does not inherit old Cloud-only browser logic or routes.
- Safety: a deny-all `src/proxy.ts` returns HTTP 503 for all dynamic requests until the new Cloud architecture passes review.

## Implemented in the guarded branch

- IndexedDB storage for sessions, worlds, characters, selves, and twelve text-only save slots.
- Browser-only virtual Officina project directories and text files; **Export project** downloads a browser-created ZIP containing the root directory (and empty subdirectories), ready to extract into Local's `IDE/`. User-approved, bounded code excerpts can reach a model for AI programming assistance, while reviewed file changes apply via browser IndexedDB, never `/api/ide`. Entire AI-generated file sets now require explicit review/approval and save together after stale-file checks.
- Text/code-only file picker; Charta Local portrait/avatar imports sanitized; old Local image uploads disabled.
- The `/api/summarize` route now accepts the same per-request BYOK credentials as chat (no shared server key fallback).
- IDE writes, imports and AI edits use atomic IndexedDB transactions with stale-content checks. Cross-tab notifications prompt explicit refresh rather than destroying drafts; ZIP export uses a consistent project snapshot.
- A masked per-provider BYOK configuration UI; keys stored only on the browser origin and passed to the model proxy with requests. The browser storage is **not encrypted**.
- Hosted image backends and image model-ID prerequisite; local ComfyUI/SD code path removed.
- Auto DJ, music scanning and server-local routes removed; bundled original WAV demo music supplied.
- Old Local file APIs under `/api/local/*` removed; server upload/auth/IDE routes return 410 behind the global 503 staging guard.
- Vercel build parsing issue found and corrected; subsequent preview builds have reported READY, but this is **not** an end-to-end browser, security or TypeScript verification.

**Still open before usable Cloud:** permit safe custom provider endpoints after SSRF mitigation, full provider and image request verification, origin/rate limiting, browser quota/recovery UX, a five-language browser regression, and broader integration testing for client-side AI review and edits (bounded source excerpts are now shared only with user consent; file writes stay in IndexedDB). The last three Cloud image placeholders need replacement. Do **not** remove the 503 guard or promote to production yet.

## Required Cloud adaptation

### Persistence
Local uses server-local `data_storage/` plus local IDE workspace. Hosted Cloud must not write shared files or reveal process-local data across users. Choose browser IndexedDB and per-user export/import or a deliberately authenticated storage service. IndexedDB has now been implemented on this staging branch; its browser data and quota behavior still need end-to-end testing.

### Provider and security boundary
Local reads server API keys in `.env.local`, unlike old Cloud's browser-supplied BYOK flow. Design a new explicit BYOK proxy and credentials UX. Audit every API route and enforce authentication/abuse limits, maximum body sizes, origin policy, timeout, redacted logs, and provider allowlist or trusted custom URLs as appropriate. Avoid client-side illusions of secrecy: any credential sent to a proxy is visible to that proxy.

### Feature scope
Preserve five-language UI and the main mode/character/worldline logic. Disable or rewrite local filesystem-backed IDE/music/gallery/ComfyUI/portrait APIs before any cloud preview becomes usable. Keep branded assets/license notices and user-authored/localized story data intact.

### Checks and promotion
Run:
```bash
npm ci
npx tsc --noEmit
npm run build
```
Then run a five-language functional and security smoke test under a deployment-protected environment. Confirm no `/api/local/*`, `/api/ide`, `/api/upload`, arbitrary execution route, or any other unreviewed endpoint can be accessed. The deny-all proxy is a **temporary circuit breaker**, not sufficient Cloud security by itself. Some Vercel preview builds have reached READY after JSX fixes, but no explicit TypeScript check, five-language browser test, or security test is recorded.

Only after these gates pass should a separate reviewed commit disable the guard and promote the new Cloud to `main`. Do not force-push away the old Cloud history.
