# Cloud browser-only data boundary

Cloud chat, Charta, 12 archive slots, and virtual IDE workspaces are stored in the current browser origin's IndexedDB. Storage capacity varies by browser, origin and disk quota; never promise a fixed 10 MB. Browser data is not encrypted and can be cleared. Users should export their work.

Server file and media endpoints from Local (`/api/local/*`) have been removed. `/api/ide`, `/api/upload` and `/api/auth` return HTTP 410. These are NOT safe shared filesystem APIs. The Cloud rebuild branch's `src/proxy.ts` also denies all dynamic requests with 503 until security review and tests are finished.

Chat attachment picker accepts text/source files only, with a 1 MiB limit. Charta character import discards standee and uploaded avatar image fields while preserving text settings and emoji avatar defaults.

BYOK API keys live in browser IndexedDB, **not encrypted**; password inputs hide their rendering only. Keys are sent with each request to the site's proxy and chosen provider. Custom URL proxying is disabled by default pending DNS/SSRF mitigation. Never put secret values in logs or document examples.

After the app builds, test all five locales, sessions, storage isolation, quota exhaustion, Cloud BYOK error handling and abuse-limiting measures before unblocking preview. No production deployment is authorized yet.
