# Shiorivia Cloud · Development / 云端版开发

This guide is for [Shiorivia_Cloud](https://github.com/Yoisidus/Shiorivia_Cloud), not the separate [Local Edition](https://github.com/Yoisidus/Shiorivia).

## Branches / 分支

- `dev`: active development and Vercel preview / 日常开发、预览和自动验证。
- `main`: reviewed production code for [app.shiorivia.com](https://app.shiorivia.com) / 正式发布。
- Develop on `dev`, verify, then merge to `main`. The original Cloud source is still traceable at historical commit `29a4d421408d4a837f7b927815d5ec876fe09fd3` without keeping temporary rebuild/backup branches.

## Start Cloud locally / 本机运行云端版源码

Install Node.js 24 (see `.nvmrc`) and npm:

```bash
git clone https://github.com/Yoisidus/Shiorivia_Cloud.git
cd Shiorivia_Cloud
git switch dev
npm ci
npm run dev
```

Open `http://localhost:3000`. This starts **Cloud source code** on localhost; it does not enable Local's filesystem or music APIs.

**Cloud BYOK setup:** In Settings Center → AI & Models, create a passphrase, enter a provider API key, select **Encrypt, save and lock**, and separately **Decrypt keys for AI use**. Cloud API keys belong in browser settings, **not `.env.local`**; the inherited `.env.example` is not the hosted Cloud setup flow.

## Test and release / 测试与发布

```bash
npm ci
npm run test:cloud-bootstrap
npm run test:cloud-ide
npm run test:cloud-api
npm run test:cloud-vault
npm run test:cloud-single-tab
npx tsc --noEmit
npm run build
```

The Cloud workflow runs on `dev`, `main`, and PRs to `main`. The test-only IndexedDB simulator is installed in CI. Automated tests do **not** replace manual five-language UI, mobile, image provider, real model call, browser quota or Tela transition testing.

Sessions, Charta text profiles, 12 save slots and the browser virtual IDE live in origin-scoped IndexedDB. First-visit Officina is a saved clean checkpoint. Users should manually save meaningful changes and export work regularly. Single-tab access is enforced per browser profile.

Cloud does **not** offer Local's filesystem-backed `/api/ide`, local music scan, server upload gallery or local ComfyUI. Custom arbitrary outbound model URLs remain disabled by default.

See [provider guide](cloud-provider-setup.md), [browser data](cloud-data-and-backups.md), [IDE](cloud-virtual-ide.md), [localization](localization.md), and [security](cloud-browser-security.md).
