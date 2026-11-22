# Shiorivia Cloud · Five-language QA / 五语言维护

This guide describes **Cloud**. Local Edition's file APIs, `.env.local` model credentials, ComfyUI and music scanning are not available here.

| Locale | Language |
| --- | --- |
| `zh-CN` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `en` | English |
| `ja` | 日本語 |
| `ko` | 한국어 |

Locale is provided by `src/context/LanguageContext.tsx`; translations live in `src/lib/i18n.ts`, `i18nDeep.ts` and `i18nLocal.ts`. Translate interface labels, notices, validation and buttons, **not** user-authored conversations, story prose, character/worldline names, API/model IDs, saved protocol tags or source code.

## Manual regression checklist / 手动验收

| Area | Verify in all five languages |
| --- | --- |
| Home and status | Cloud Edition badge; first-run saved greeting; only real edits show Unsaved |
| API vault | Draft → Encrypt/save/lock → separate decrypt → AI use; wrong passphrase; budget notice |
| Tabs | Old tab retained; new tab blocked; manual retry after close |
| Officina | Text-only virtual IDE, consent-gated edits, project ZIP |
| Umbra and Via Lata | Worldline / cast / memory workflow |
| Tela | Chapter creation/export, parchment entry and exit on desktop and mobile |
| VIAE and Charta | Roads, selves, worlds and Cloud text-avatar limitations |
| Media | Hosted image-provider setup; disabled local features do not mislead users |

Do not claim a full browser acceptance solely from the automated tests. Run `npm ci`, the `test:cloud-*` scripts, `npx tsc --noEmit`, `npm run build`, then manually test browser, mobile width and five locales. Existing saved text must remain unchanged when switching language.

参阅 [README](../README.md)、[development](development.md)、[browser backups](cloud-data-and-backups.md)。
