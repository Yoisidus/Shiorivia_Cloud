# Shiorivia Cloud · Browser, key and provider boundary

**Cloud beta / 云端测试版：** origin-scoped browser persistence, user-provided model keys and a constrained request proxy.

## Browser data

- Sessions, Charta, 12 save slots and browser virtual IDE projects use IndexedDB and **are not encrypted as general user content**. There is no account-based sync; browser data can be removed by clearing site storage.
- The first-run Officina greeting is automatically saved as the initial clean session snapshot; the home-page “Unsaved changes” state is reserved for changes after that checkpoint.
- BYOK credentials are a separate encrypted IndexedDB record: PBKDF2-SHA256 (310,000 iterations) and AES-256-GCM, with a fresh 96-bit IV for each save. The passphrase is not stored; losing it prevents decrypting saved keys.
- User edits API keys in a draft, explicitly **encrypts/saves/locks**, then separately **decrypts into current-tab memory** for AI use. Refresh, page close or user clear removes the running app's usable keys. Draft edits never automatically reach a model. Transactional compare-and-swap guards stale ciphertext overwrites.
- Single-tab Web Locks ensure one active Cloud tab per browser profile. Another tab is blocked before mounting chat or the vault. Separate profiles are independent; the lock is coordination, not a defense against browser malware.

## Model proxy

- Same-origin mutation policy in `src/proxy.ts`, disabled CORS preflight, bounded JSON requests (chat 2 MiB, summarize 256 KiB, draw 128 KiB), and best-effort per-instance rate caps. These are not distributed abuse protection.
- Built-in provider destinations are fixed; arbitrary custom URLs remain disabled by default pending DNS/SSRF review. **Recommend provider-side spending limits** for direct API billing.
- External AI providers process submitted prompts through the Cloud proxy. User-approved bounded code excerpts may be included in Officina requests.
- `/api/ide`, `/api/upload`, `/api/auth` return 410; Local filesystem/server upload execution is not exposed.

## Verification

CI covers first-run saved state, IndexedDB IDE transactions, ZIP export, crypto round trips, origin/request limits, single-tab handling, TypeScript and build. Five-language real-browser, quota exhaustion and live-model integration acceptance remain manual. See [SECURITY.md](../SECURITY.md), [API guide](cloud-provider-setup.md), [backup guide](cloud-data-and-backups.md).
