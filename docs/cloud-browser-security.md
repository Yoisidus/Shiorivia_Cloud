# Shiorivia Cloud browser boundary — public beta

Cloud sessions, Charta, 12 save slots and Officina virtual IDE projects are persisted in origin-scoped IndexedDB; these are **not server accounts**. Storage is not encrypted, may be evicted, and can be cleared. Export important work regularly.

The global staging 503 has been replaced by a request-protecting `src/proxy.ts`: cross-origin mutating API requests are rejected and only same-origin browser requests are accepted. CORS preflights receive 405. API caching is disabled and basic security headers are sent. Best-effort rate counters are **per server instance**; they do not provide distributed abuse protection or guarantee against automated use.

Chat, summarize and image-generation request bodies are streamed through bounded JSON readers, to prevent large chunked bodies bypassing `Content-Length` limits (2 MiB, 256 KiB, 128 KiB respectively). Built-in provider destinations are fixed; custom arbitrary endpoints remain disabled. Model provider keys are supplied by each browser; there are no shared server API keys. Provider-controlled spending limits remain essential.

Server file and media endpoints from Local have been removed; `/api/ide`, `/api/upload`, `/api/auth` respond HTTP 410. Filesystem editing remains browser-only. Officina source excerpts are sent to the model only with confirmation; secrets inside ordinary source files are still possible.

Text/source attachments have a 1 MiB cap; Charta JSON imports discard standees and picture avatars. **BYOK keys are not encrypted in IndexedDB**, regardless of masked password fields.

The automated CI suite verifies API request size boundaries, origin policy, TypeScript, browser IDE transactional writes and ZIP structure; five-locale interactive browser testing, quotas, full BYOK provider requests, real-device behavior, and production-grade distributed rate limiting are still outstanding. Beta is owner-led manual testing, not a security certification.

### Credential vault update
BYOK values are protected at rest by a passphrase-derived PBKDF2-SHA256 (310,000 iterations) AES-256-GCM browser vault. A fresh 96-bit IV is used for each write. The passphrase and non-exportable CryptoKey are memory-only; each newly opened tab requires a passphrase. Legacy plaintext BYOK entries are migrated only after a passphrase is chosen and replaced atomically. A forgotten passphrase requires deleting saved keys. Encryption does not prevent XSS, malicious browser extensions, unlocked devices or a compromised client/browser; spending limits and HTTPS remain necessary.

The vault auto-locks after 20 minutes without user interaction. A ciphertext compare-and-swap in the same IndexedDB transaction rejects conflicting writes across tabs rather than silently overwriting a more recent key record.
