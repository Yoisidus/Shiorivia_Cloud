# Cloud BYOK · API keys and encrypted vault
# 云端版密钥保险箱

This is **Cloud Edition**; do not enter model keys into a server `.env.local`.

## Configure / 初次配置

1. Open Settings Center → AI & Models.
2. Create a passphrase of **at least 12 characters** and enter at least one supported API key (and supported URL if applicable).
3. Click **Encrypt, save and lock / 加密保存并锁定**. Draft entries are not saved until this action; the passphrase itself is never stored.
4. The separate **Decrypt keys for AI use / 解密密钥** section appears after saving an encrypted record. Enter the passphrase once to load keys into the current tab's memory for AI requests.
5. To change a key, choose **Edit saved API keys / 编辑已保存的密钥**, enter the original passphrase, edit the draft and explicitly save and lock again. Edited drafts do not automatically go to AI or storage.

**费用提示：** 请前往所选模型供应商后台设置**消费上限**。已解密的密钥在当前页面内存中使用，关闭或刷新后需再次解密；不会被写进会话或 IDE 导出。忘记保险箱口令意味着无法解密原来的密文。

## Providers / 供应商

| Provider | Cloud status |
| --- | --- |
| DeepSeek, OpenRouter, Google Gemini | User-supplied keys for supported model requests |
| fal.ai | Hosted image backend when supported |
| Custom_1–4 | Settings placeholders; **arbitrary custom provider destinations disabled by default** |
| Local ComfyUI | Not supported on hosted Cloud |

Keys are encrypted at rest using passphrase-derived PBKDF2-SHA256 and AES-256-GCM, with a new IV per saved update. They are supplied per request through Cloud's model proxy to the selected provider. Provider usage limits are a practical financial safeguard. Browser-side encryption does not prevent the selected provider from processing your prompts.

See [security](cloud-browser-security.md) and [browser storage](cloud-data-and-backups.md).
