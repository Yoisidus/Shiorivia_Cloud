# Shiorivia Cloud browser boundary — public beta

Cloud sessions, Charta, 12 save slots and Officina virtual IDE projects are persisted in origin-scoped IndexedDB; these are **not server accounts**. Storage is not encrypted, may be evicted, and can be cleared. Export important work regularly.

The global staging 503 has been replaced by a request-protecting `src/proxy.ts`: cross-origin mutating API requests are rejected and only same-origin browser requests are accepted. CORS preflights receive 405. API caching is disabled and basic security headers are sent. Best-effort rate counters are **per server instance**; they do not provide distributed abuse protection or guarantee against automated use.

Chat, summarize and image-generation request bodies are streamed through bounded JSON readers, to prevent large chunked bodies bypassing `Content-Length` limits (2 MiB, 256 KiB, 128 KiB respectively). Built-in provider destinations are fixed; custom arbitrary endpoints remain disabled. Model provider keys are supplied by each browser; there are no shared server API keys. Provider-controlled spending limits remain essential.

Server file and media endpoints from Local have been removed; `/api/ide`, `/api/upload`, `/api/auth` respond HTTP 410. Filesystem editing remains browser-only. Officina source excerpts are sent to the model only with confirmation; secrets inside ordinary source files are still possible.

Text/source attachments have a 1 MiB cap; Charta JSON imports discard standees and picture avatars. **BYOK keys are not encrypted in IndexedDB**, regardless of masked password fields.

The automated CI suite verifies API request size boundaries, origin policy, TypeScript, browser IDE transactional writes and ZIP structure; five-locale interactive browser testing, quotas, full BYOK provider requests, real-device behavior, and production-grade distributed rate limiting are still outstanding. Beta is owner-led manual testing, not a security certification.

### Credential vault update
BYOK values are protected at rest by a passphrase-derived PBKDF2-SHA256 (310,000 iterations) AES-256-GCM browser vault. A fresh 96-bit IV is used for each write. The passphrase and non-exportable CryptoKey are memory-only; each newly opened tab requires a passphrase. Legacy plaintext BYOK entries are migrated only after a passphrase is chosen and replaced atomically. A forgotten passphrase requires deleting saved keys. Encryption does not prevent XSS, malicious browser extensions, unlocked devices or a compromised client/browser; spending limits and HTTPS remain necessary.

The vault has separate encryption/editing and runtime-decryption steps: editing is a memory-only draft until the user explicitly saves and locks an AES-GCM ciphertext. Existing saved keys can be edited only after the passphrase is supplied. The separate decrypt action loads keys into the active tab memory until page reload, close or explicit Clear from memory; the old 20-minute auto-lock is removed. Compare-and-swap protects saved vault overwrites. Editing never automatically supplies draft keys to a model.

### Single active Cloud tab
The Cloud application is mounted only after an exclusive origin-scoped Web Lock (`shiorivia-cloud-primary-tab-v1`) is acquired. The first active tab keeps the lock while backgrounded; a second tab shows a translated blocked screen and **does not mount the chat, music provider, or BYOK vault**. It does not evict the original tab, and the second tab does not automatically take over. After closing the original tab, the user can explicitly retry. Pagehide releases the lock; bfcache pages re-check on pageshow. Browsers without Web Locks fail closed rather than risk simultaneous editors. Distinct browser profiles and different origins remain independent. This is a client-side coordination/UX feature, not a security boundary; transactional IndexedDB checks remain necessary to protect AI/manual writes and unexpected races.
