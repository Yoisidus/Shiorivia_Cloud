# Shiorivia Cloud ☁️

**Status: public beta for manual owner testing (2026-11-21).** Built from [Shiorivia Local](https://github.com/Yoisidus/Shiorivia) with a browser-first persistence and BYOK boundary. This is a new Cloud implementation, not a full hosted copy of Local.

> Source history and rollback: old Cloud main is preserved at `archive/cloud-before-local-rebuild-2026-11-21` (commit `29a4d421408d4a837f7b927815d5ec876fe09fd3`). The `rebuild/local-foundation` development branch remains available after promotion.

## Browser-first features

| Feature | Behavior in Cloud |
| --- | --- |
| Sessions, Charta and 12 save slots | Origin-scoped IndexedDB; **not encrypted**; cleared if browser data is cleared |
| Officina IDE | Text/code projects up to 500 files, 256 KiB per file, 5 MiB per project; atomic writes and cross-tab change alerts |
| Project export | Browser-generated ZIP containing root project folder, nested files and empty directories; extract into Local's `IDE/` to transfer |
| AI code edits | Explicit review before model-suggested file writes or patch application; bounded excerpts shared only with approval |
| Models | User-provided DeepSeek / OpenRouter / Google BYOK credentials, AES-256-GCM encrypted at rest with a user passphrase, decrypted only in the unlocked page for Cloud proxy requests |
| Custom provider endpoints | **Disabled by default**, pending DNS rebinding/SSRF audit |
| Media | Hosted image providers only; local ComfyUI, server uploads, filesystem IDE and automatic music scanning disabled |

## Security and beta limitations

- The global HTTP 503 staging block has been removed for manual beta testing. The API proxy checks same-origin writes, rejects CORS preflight, applies best-effort per-instance rate caps, and uses bounded JSON readers (chat 2 MiB, summarize 256 KiB, draw 128 KiB).
- **Rate caps are not distributed** between Vercel instances. A production-scale rollout requires edge/WAF protection, abuse monitoring and load testing. Use your own provider API keys, with provider-side budget caps.
- Sessions and Charta data remain **not encrypted**. BYOK keys are encrypted at rest using PBKDF2-SHA256 + AES-256-GCM; the passphrase is not saved and is required when opening a fresh tab. Existing plaintext keys require one-time migration via Settings. A lost passphrase cannot recover keys. Encryption does not protect against malicious scripts, browser extensions or an unlocked device. Set provider spending limits.
- Old Local-only routes `/api/ide`, `/api/upload`, `/api/auth` return 410; no server filesystem access.
- Five-language interactive browser acceptance, full model-provider verification, quota exhaustion, and real device testing require manual owner validation. Three inherited image placeholders also need replacement.

## Automated checks

```bash
npm ci
npx tsc --noEmit
npm run test:cloud-ide
npm run test:cloud-api
npm run build
```

GitHub Actions runs these on `rebuild/local-foundation`. The tests cover IndexedDB version conflicts, batch AI patches, invalid paths, ZIP round trips, JSON size limits, API origin rules, and encryption vault round trips. A successful build is **not** a substitute for real browser tests.

See [Cloud browser security](docs/cloud-browser-security.md), [virtual IDE](docs/cloud-virtual-ide.md), and [original rebuild checkpoint](docs/cloud-rebuild-checkpoint.md).

**Maintainer note:** If a beta regression affects users, rollback reference is `archive/cloud-before-local-rebuild-2026-11-21`; do not force-push away history.
