# Shiorivia Local — five-language UI maintenance / 五语言界面维护

This guide describes **Shiorivia Local** in `seemoon1/Shiorivia`. The [Cloud Edition](https://github.com/seemoon1/Shiorivia_Cloud) is a separate repository; these Local UI audits and fixes do **not** claim Cloud has the same functionality or translation coverage.

本指南仅对应 Shiorivia **本地版**。云端版有独立仓库，不应将本地版的功能、测试结果或完成状态直接套用至 Cloud。

## Supported locales / 已支持语言

| Locale code | Language | 界面语言 |
| --- | --- | --- |
| `zh-CN` | Simplified Chinese | 简体中文 |
| `zh-TW` | Traditional Chinese | 繁體中文 |
| `en` | English | 英语 |
| `ja` | Japanese | 日本語 |
| `ko` | Korean | 한국어 |

The UI locale is provided by `src/context/LanguageContext.tsx` via `useLanguage()`. A saved browser preference is used when available; otherwise the browser locale is normalized to a supported language. The language preference is client-side and does not rewrite session archives.

The main translation sources are `src/lib/i18n.ts` (core `t()` keys), `src/lib/i18nDeep.ts` (`deepText(locale, key)`), and `src/lib/i18nLocal.ts` (Local-specific copy). `src/lib/chartaErrorText.ts` translates **known** Charta parser errors only at the display boundary; unrecognized raw errors pass through unchanged.

## Translate interface copy, not data / 翻译界面，不改存档

- **Translate:** visible headings, navigation buttons, empty-state explanations, worldline and cast instructions, validation feedback, notifications, accessible labels, image descriptions and confirmation text.
- **Preserve as-is:** Shiorivia, Officina, Via Lata, Umbra, Tela, VIAE, Charta, Semita, Compitum, character names, provider/model names, WORLD/ERA/PERIOD, stable IDs, JSON fields and `<game_state>`, `<novel_state>`, `<viae_chat>`, `<turn_memory>` and other protocol tokens.
- **Never modify or auto-translate:** previously saved chats, prose, user-authored Charta names, world descriptions, custom gender, music folder keys, Environment/Event/Style drafts, session IDs or archive schema merely because the UI locale changed.
- Charta's optional per-stage `descriptions[locale]` are authored individually. A missing locale description stays blank; it must not silently copy an unrelated language.
- Translate dynamic confirmations carefully: the text displayed for an action (including batch-delete confirmation phrases) must remain in sync with its actual validator and preserve access-code requirements.

## Current Local workflows to check / 模式验收路径

| Area | Manual five-language checks / 五语言手工检查 |
| --- | --- |
| **Shared UI** | Mode hub, left/right sidebars, session menu, provider/model selectors, tooltips, image lightbox, session notes, Memory Vault, archive slots, syncing/conflict and destructive-action dialogs |
| **Officina** | New engineering session, persona binding, project root in `IDE/`, IDE tree, file save confirmation, sync and legacy import, localized error feedback |
| **Via Lata** | Worldline WORLD/ERA/PERIOD selection, Observer/Participant explanation, empty cast, first-turn optional cast and later read-only cast, POV states, plot-suggestion confirmation |
| **Umbra** | **Worldline not configured:** right-sidebar empty state and left-sidebar notice; button above the locked composer must **open the Umbra worldline dialog**, even if the left sidebar is already open. Set a worldline, pick an eligible character, then switch speakers and check separate Memory Vaults |
| **Tela** | Worldline prerequisite, Environment/Event/Style, six creative presets, chapter creation, cast picker, JSON / DOCX archive, suggestion insertion, transition and reader |
| **VIAE** | Sidebar actions **Start Semita / Create Compitum** with the localized verb separate from the product noun; route creation, worldline, member count, observer/participant, voice and message actions, manual local save |
| **Charta** | Character/self/world cabinet, five-language labels, structured lore and timeline, validation and import/export notices, custom user-authored fields unaffected by locale switching |

Repeat the checks for all five locale codes, including mobile-width navigation and dialogs where possible. Compare previously saved prose and IDs before/after a language switch; they must be identical.

简体中文、繁體中文、English、日本語、한국어都要检查：不仅是默认界面，还要检查“尚未配置世界线”、空角色列表、保存失败、确认弹窗、切换语言后重新打开弹窗等容易遗漏的状态。

## Build and browser verification / 构建与浏览器验证

From your own clone of **Local**:

```bash
npm ci
npx tsc --noEmit
npm run build
npm run dev
```

Open `http://localhost:3000` in a trusted local browser. The optional Windows `start_shiorivia.bat` launcher builds and starts the **production** server (`npm run build` then `npm run start`); it is not equivalent to `npm run dev`. The legacy Next.js config may bypass some build-time TypeScript/ESLint checks, so run `npx tsc --noEmit` explicitly. Do not expose Local's file/IDE APIs on a public interface.

**Verification status as of 2026-11-21:** the multilingual changes and the VIAE/Umbra follow-up were checked at **GitHub source / static-reference level**. No passing end-to-end five-locale browser run, TypeScript compilation or Next.js production build is claimed by this documentation update. Record actual test commands, device/browser, locale and results when those tests are completed.

**后续协作提示：** README 的五语言段落应同步更新；文档中的“已完成”只代表已落实的源码变更，不应把待做的浏览器、编译或 Cloud 版验证写成通过。相关流程可继续参考 [Local development](development.md)、[Umbra](umbra-multichar-worldlines.md)、[VIAE](multi-worldline-viae.md) 和 [Tela](novel-worldline-rebuild.md)。
