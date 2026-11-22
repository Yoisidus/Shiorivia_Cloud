# Shiorivia Cloud · Documentation / 云端版文档

**Cloud is a browser-first edition. / 云端版以浏览器存储为核心。** Please use Cloud-specific guides below: inherited Local documents may describe filesystem access, local music or server `.env.local` keys that are unavailable on Cloud.

| Current Cloud guide / 云端版指南 | Topic |
| --- | --- |
| [README (five languages)](../README.md) | Product overview, modes, getting started / 五语言入门 |
| [Development](development.md) | `dev → main` workflow, build and verification / 开发流程 |
| [API keys](cloud-provider-setup.md) | Encrypt-and-save vault and separate in-memory decryption / 密钥保险箱 |
| [Browser data](cloud-data-and-backups.md) | Saved state, exports and backups / 存储和备份 |
| [Virtual IDE](cloud-virtual-ide.md) | Text projects, export ZIP, approved AI edits / 虚拟 IDE |
| [Security boundary](cloud-browser-security.md) | What Cloud stores and sends / 安全边界 |
| [Localization QA](localization.md) | Five-language checks / 五语言检查 |
| [Rebuild checkpoint](cloud-rebuild-checkpoint.md) | **Historical record only** / 历史记录 |

## Inherited Local feature documents / 继承的本地版文档

Documents on filesystem Officina IDE, `data_storage/`, ComfyUI, Local API providers, portrait files, local music scanning and startup scripts were inherited from [Shiorivia Local](https://github.com/Yoisidus/Shiorivia). They may be useful as implementation history but **do not describe the hosted Cloud site**. For Cloud behavior, follow the guides above.

其余文档保留了部分 Local 功能设计，不能直接当作 Cloud 的操作指南；尤其不要在 Cloud 网站上寻找 `.env.local`、本机音乐扫描或服务器磁盘文件。
