# Shiorivia Cloud · Security / 安全说明

**Cloud Edition is a browser-first beta, not the Local Edition server.** This page gives a concise description of the actual boundaries, not a certification.

- **API keys / 密钥**: encrypted in the current browser using passphrase-derived AES-256-GCM. The passphrase is not persisted. Edit-and-save is separate from decrypting keys into the active tab's memory for model requests. **Set spending limits** in your provider dashboard.
- **User content / 用户作品**: sessions, Charta text data, saves and virtual IDE projects use browser IndexedDB and are not encrypted as a group. They are not backed by an account. Save and export important work before clearing site data.
- **Provider requests / 模型调用**: prompts and request data are sent via the Cloud proxy to the selected AI provider. Browser encryption at rest does not prevent the provider from processing submitted prompts.
- **Server limits**: same-origin mutation checks, bounded request bodies, best-effort instance-local rate limits and disabled Local filesystem/upload endpoints. Custom arbitrary URL endpoints are off by default.
- **Tabs / 标签页**: one active Cloud tab per browser profile via Web Locks, primarily to prevent conflicting edits.

Do not include real API keys or private conversations in GitHub issues. Do not turn on unreviewed arbitrary outbound provider URLs or Local filesystem execution routes. Keep third-party artwork/character rights in mind. Automated testing does not replace manual browser, provider and device validation.

Detailed boundaries: [Cloud browser security](docs/cloud-browser-security.md) · [API keys](docs/cloud-provider-setup.md) · [Browser backups](docs/cloud-data-and-backups.md). Report sensitive security concerns privately to maintainers when a private contact channel is available.
