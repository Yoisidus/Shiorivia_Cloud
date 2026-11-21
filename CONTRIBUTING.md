# Contributing to Shiorivia / 参与贡献

Thanks for helping Shiorivia! / 感谢你参与星轨项目。

## Getting started / 开始开发

1. Read [SECURITY.md](SECURITY.md), [BRANDING.md](BRANDING.md), and [TRADEMARKS.md](TRADEMARKS.md).
2. Follow [docs/development.md](docs/development.md) to run the Local Edition.
3. Create a focused branch, keep changes small, and test what you changed.
4. Open an Issue or Pull Request describing the motivation, changes, and test results.

请先阅读安全与品牌政策，按照开发指南配置环境。尽量让每次 PR 专注一件事，并写清用途、改动和验证方式。

## Before opening a PR / 提交前检查

- Run `npm ci`, `npx tsc --noEmit`, and `npm run build` where possible. Report pre-existing failures honestly.
- Never commit `.env.local`, provider API keys, session data, private chat logs, or files under `data_storage/`.
- Do not contribute copyrighted character art, Live2D models, commercial music, or other third-party material without clear redistribution rights and attribution.
- Do not rename the fictional character ID `mutsu` as part of a product-brand cleanup.
- Security issues should be reported privately through a maintainer-designated channel when available; do not publish secrets or exploit details in Issues.

## Five-language interface changes / 五语言界面贡献

When adding or editing visible UI copy, update all **five locales**: `zh-CN`, `zh-TW`, `en`, `ja` and `ko`. Use the existing localization helpers rather than hard-coding Chinese or English inside buttons, empty states, confirmations, placeholders, `title`, `alt` or `aria-label`.

- Check `src/lib/i18n.ts`, `src/lib/i18nDeep.ts`, `src/lib/i18nLocal.ts` and `src/context/LanguageContext.tsx` before adding keys. The active locale is read through `useLanguage()`.
- Do **not** translate machine identifiers, route types, persistent JSON keys, provider protocol strings, output tags, user-created names or stored story content. Translate validation errors at the UI boundary, preserving raw parser behavior and archived data.
- Review the [five-language QA checklist](docs/localization.md) across Officina, Via Lata, Umbra, Tela, VIAE and shared Charta. Include concrete test evidence; source inspection alone is **not** a successful browser or build test.
- Keep **Shiorivia Local** changes in this repository. Cloud-specific development belongs in [Shiorivia_Cloud](https://github.com/seemoon1/Shiorivia_Cloud).

新增或修改可见文案时，请同时提供五种语言，包含空状态、弹窗、错误提示和无障碍文本；不要翻译协议 ID、存档字段或用户原创内容。提交前按[多语言测试清单](docs/localization.md)逐个模式检查，并如实记录没有运行的编译/浏览器测试。Local 与 Cloud 代码分别在各自仓库维护。

源码遵循 [AGPL-3.0](LICENSE)；官方名称及视觉标识另见 [TRADEMARKS.md](TRADEMARKS.md)。贡献代码不自动获得商用官方品牌授权。
