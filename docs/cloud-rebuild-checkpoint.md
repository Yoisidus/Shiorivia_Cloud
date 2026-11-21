# Cloud rebuild checkpoint — 2026-11-21

This is an **engineering checkpoint**, not the Cloud release.

- Source: `seemoon1/Shiorivia` `c9ba70d7e4e3660af747c44fa0bc148c9c023d15`.
- Destination: `seemoon1/Shiorivia_Cloud`, branch `rebuild/local-foundation`.
- Rollback: `archive/cloud-before-local-rebuild-2026-11-21` points to original Cloud `main` `29a4d421408d4a837f7b927815d5ec876fe09fd3`.
- Production: Vercel `shiorivia_cloud`, `app.shiorivia.com`, connected to old `main`; unchanged in this checkpoint.
- Imported: Local source files, docs, project configuration, and shared text assets; README is replaced with this staging note.
- Kept temporarily from old Cloud: `public/music/demo.mp3`, `public/shiorivia-app-icon.png`, `public/shiorivia-favicon-32.png`, `public/shiorivia-og.png`; replace with actual Local-licensed assets or fresh Cloud assets before release.
- Not copied: Cloud legacy Python function `api/run_cloud.py`; the new tree does not inherit old Cloud-only browser logic or routes.
- Safety: a deny-all `src/proxy.ts` returns HTTP 503 for all dynamic requests until the new Cloud architecture passes review.

## Required Cloud adaptation

### Persistence
Local uses server-local `data_storage/` plus local IDE workspace. Hosted Cloud must not write shared files or reveal process-local data across users. Choose browser IndexedDB and per-user export/import or a deliberately authenticated storage service. Neither model exists in this staged snapshot.

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
Then run a five-language functional and security smoke test under a deployment-protected environment. Confirm no `/api/local/*`, `/api/ide`, `/api/upload`, arbitrary execution route, or any other unreviewed endpoint can be accessed. The deny-all proxy is a **temporary circuit breaker**, not sufficient Cloud security by itself. There has been no successful build or security test recorded for the migrated branch.

Only after these gates pass should a separate reviewed commit disable the guard and promote the new Cloud to `main`. Do not force-push away the old Cloud history.
