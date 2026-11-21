# Shiorivia Cloud — rebuilding from the Local foundation ☁️

> **Status: source migration, NOT a deployable public Cloud release.** This repository's `rebuild/local-foundation` branch imports the current [Shiorivia Local](https://github.com/seemoon1/Shiorivia) source as the starting point for a new lightweight, browser-first Cloud Edition. It is **not** equivalent to a hosted version of Local.

The previous Cloud implementation and its deployment history are preserved on the `main` branch and the immutable-point-in-time branch `archive/cloud-before-local-rebuild-2026-11-21`. The existing Vercel production domain remains on `main`; do **not** promote the rebuild branch as-is.

## What is imported?

The Local component, UI localization, five-mode functionality, Charta lore, cast/worldline logic, local development documents and current dependency definitions are copied for adaptation. Original Cloud-only code (including the legacy browser BYOK and security proxy) remains recoverable from the archive branch.

**Safety barrier:** `src/proxy.ts` currently returns HTTP 503 for all dynamic requests, including local and model APIs, on the rebuild branch. It intentionally makes this branch unusable as a hosted application until Cloud-specific APIs, permissions and browser data storage have been implemented. The legacy Python function entry point was omitted rather than copied into the new Cloud source tree.

## Work required before preview or production

1. Replace Local server-side `data_storage/`, filesystem and IDE access with a browser-first/private Cloud model (for example IndexedDB, explicit file import/export, and optional user-approved integrations).
2. Remove or deny Local-only routes including `/api/local/*`, `/api/ide`, `/api/upload` and any unsafe arbitrary-run routes; audit the remaining model, image, music and helper APIs.
3. Design BYOK handling, API proxy security, abuse limits, CORS/origin checks, retention and storage limits. Browser localStorage is not an encrypted vault.
4. Replace development-only environment defaults, switch to Cloud metadata, and decide which media features to disable rather than attempting server-local music or ComfyUI features.
5. Restore or explicitly replace the **four original binary assets** (music sample, app icon, favicon and Open Graph image): GitHub's connected text-oriented file tools cannot copy their raw bytes, so temporary old-Cloud placeholder versions are used in this branch.
6. Run explicit `npx tsc --noEmit`, `npm run build`, and five-language browser tests under protected previews. Only then remove the staging guard and separately approve deployment to `main`.

The Local README and detailed feature documents are available in the [Local repository](https://github.com/seemoon1/Shiorivia) and the copied `docs/` tree. Local documentation in this temporary branch describes the upstream **Local implementation**, not completed Cloud capabilities.

**Source reference:** `seemoon1/Shiorivia@c9ba70d7e4e3660af747c44fa0bc148c9c023d15` (2026-11-21).

---

## 中文说明

这里是**新一代 Shiorivia Cloud 的代码重建分支**，以最新 Local 代码为基础，暂时**不对公网开放**，也**不是可直接部署的 Cloud 正式版**。

旧 Cloud 已备份在 `archive/cloud-before-local-rebuild-2026-11-21`，现有 `main` 和 `app.shiorivia.com` 的生产版本保持不变。重建分支暂时在 `src/proxy.ts` 拦截所有动态请求，以免把 Local 的文件系统、IDE 等功能意外开放到公网。

下一阶段重点是浏览器本地保存、BYOK 安全边界、禁用或改造本机 API、替换四个临时二进制占位资源，最后完成编译与五语言浏览器验收。**未经检查，请勿将此分支部署为公开站点。**
