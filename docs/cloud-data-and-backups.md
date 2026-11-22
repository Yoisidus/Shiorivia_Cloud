# Cloud browser data & backups / 浏览器存储与备份

Cloud uses origin-scoped **IndexedDB** to store sessions, Charta text profiles, 12 save slots and Officina text/IDE projects. It does **not** provide an account synced across browsers or devices. Browser data is not encrypted as a whole; the API key vault is a **separate encrypted record**.

## Home-page browser status / 首页状态

| State | Meaning |
| --- | --- |
| Reading browser data / 正在读取 | Waiting for initialization |
| Ready / 已就绪 | Current chat snapshot matches saved data; a first-run Officina welcome is now saved as the clean baseline |
| Unsaved / 未保存 | Sessions or related chat state changed since the last committed snapshot |
| Saved / 已保存 | Browser IndexedDB write completed |
| Error / 保存失败 | Browser rejected the write; check capacity or settings |

The badge refers primarily to **session storage**, not every IDE/Charta record. Creating a system welcome session on first load is not an unsaved user change.

## Save and export / 保存建议

- Use the app's manual **Save to browser** action for meaningful conversation edits. Auto-save, if enabled, is based on completed-turn preferences and may not immediately save non-chat changes.
- In Officina, **Export project** downloads a ZIP of the saved project. Extract into Local Edition's `IDE/` folder if transferring work.
- Export novel/Charta content using available workspace tools and retain copies outside the browser.
- Browser quota limits, profile resets, device changes or clearing site data can erase saved work; back up important data.
- API keys are **not** included in project ZIPs. Keep the original provider key and your vault passphrase safely; a forgotten passphrase cannot recover the ciphertext.

Cloud limits each browser profile to one active tab. Separate profiles have their own data and do not sync. AI prompts explicitly sent for generation leave the browser and reach the selected provider through the Cloud proxy.

See [README](../README.md), [virtual IDE](cloud-virtual-ide.md), and [security](cloud-browser-security.md).
