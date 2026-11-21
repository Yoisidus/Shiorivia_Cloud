# Shiorivia Cloud — rebuilding from the Local foundation ☁️

> **Status: source migration, NOT a deployable public Cloud release.** This repository's `rebuild/local-foundation` branch imports the current [Shiorivia Local](https://github.com/Yoisidus/Shiorivia) source as the starting point for a new lightweight, browser-first Cloud Edition. It is **not** equivalent to a hosted version of Local.

The previous Cloud implementation and its deployment history are preserved on the `main` branch and the immutable-point-in-time branch `archive/cloud-before-local-rebuild-2026-11-21`. The existing Vercel production domain remains on `main`; do **not** promote the rebuild branch as-is.

## What is imported?

The Local component, UI localization, five-mode functionality, Charta lore, cast/worldline logic, local development documents and current dependency definitions are copied for adaptation. Original Cloud-only code (including the legacy browser BYOK and security proxy) remains recoverable from the archive branch.

**Safety barrier:** `src/proxy.ts` currently returns HTTP 503 for all dynamic requests, including local and model APIs, on the rebuild branch. It intentionally makes this branch unusable as a hosted application until Cloud-specific APIs, permissions and browser data storage have been implemented. The legacy Python function entry point was omitted rather than copied into the new Cloud source tree.

## Cloud browser-first implementation (staging)

| Component | Current Cloud rebuild behavior |
| --- | --- |
| Sessions, folders, and manual save | Origin-scoped IndexedDB; UI text now says **Save to browser** in all five locales |
| Charta characters, selves, worlds | IndexedDB; Local character JSON imports retain text but strip standees and uploaded picture avatars |
| Archive slots | 12 browser-only, text-based slots in IndexedDB; no large screenshot thumbnails |
| Chat attachments | Text and source-code extensions only, up to 1 MiB each; no image/video/background uploads |
| Officina IDE | Virtual project folders and code files in IndexedDB (500 files, 256 KiB each, 5 MiB per project). **Export project** downloads a ZIP containing the full root folder and nested text files for Local's `IDE/`. AI code review/editing uses explicit user approval to share bounded source excerpts and applies confirmed changes in-browser |
| API settings | Masked BYOK key inputs and custom HTTPS URL fields; keys saved in browser IndexedDB and transmitted to proxy only with requests |
| Image generation | Hosted model providers only, with explicit model ID and configured provider required; no ComfyUI or local Stable Diffusion |
| Music | A single original 6-second Cloud demo track; Auto DJ and local library scanning disabled |

**Important limits:** This is source-level work on a locked staging branch. The automatic Vercel preview build has reached READY for some commits, but explicit `npx tsc --noEmit`, five-language browser interaction tests, and security/load testing are still outstanding. The proxy intentionally responds with HTTP 503 and therefore prevents normal application use for now.

**Custom provider URLs:** The setting accepts/saves user-chosen URLs, but server-side arbitrary URL proxying is **disabled by default**, pending SSRF/DNS rebinding protection. Users can still configure built-in DeepSeek/OpenRouter/Google/fal API keys. Storing a password-type input in IndexedDB does **not** encrypt it.

## Work required before preview or production

1. Replace Local server-side `data_storage/`, filesystem and IDE access with a browser-first/private Cloud model (for example IndexedDB, explicit file import/export, and optional user-approved integrations).
2. Remove or deny Local-only routes including `/api/local/*`, `/api/ide`, `/api/upload` and any unsafe arbitrary-run routes; audit the remaining model, image, music and helper APIs.
3. Design BYOK handling, API proxy security, abuse limits, CORS/origin checks, retention and storage limits. Browser localStorage is not an encrypted vault.
4. Replace development-only environment defaults, switch to Cloud metadata, and decide which media features to disable rather than attempting server-local music or ComfyUI features.
5. Replace the **three remaining image placeholders** (app icon, favicon and Open Graph image). The earlier music placeholder was replaced with a newly generated original Cloud demo WAV.
6. Run explicit `npx tsc --noEmit`, `npm run build`, and five-language browser tests under protected previews. Only then remove the staging guard and separately approve deployment to `main`.

The Local README and detailed feature documents are available in the [Local repository](https://github.com/Yoisidus/Shiorivia) and the copied `docs/` tree. Local documentation in this temporary branch describes the upstream **Local implementation**, not completed Cloud capabilities.

**Source reference:** `Yoisidus/Shiorivia@c9ba70d7e4e3660af747c44fa0bc148c9c023d15` (2026-11-21).

---

## 中文说明

这里是**新一代 Shiorivia Cloud 的代码重建分支**，以最新 Local 代码为基础，暂时**不对公网开放**，也**不是可直接部署的 Cloud 正式版**。

旧 Cloud 已备份在 `archive/cloud-before-local-rebuild-2026-11-21`，现有 `main` 和 `app.shiorivia.com` 的生产版本保持不变。重建分支暂时在 `src/proxy.ts` 拦截所有动态请求，以免把 Local 的文件系统、IDE 等功能意外开放到公网。

下一阶段重点是浏览器本地保存、BYOK 安全边界、禁用或改造本机 API、替换四个临时二进制占位资源，最后完成编译与五语言浏览器验收。**未经检查，请勿将此分支部署为公开站点。**
