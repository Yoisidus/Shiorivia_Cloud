# Officina · Character Engineer persona and lore controls

Shiorivia Local only. Engineering mode is a **character engineer**: the currently selected Charta or built-in character helps the user debug, explain and write production-grade code while retaining their own mannerisms and voice. A greeting is a normal character conversation, not a trigger to force a code-generation response.

## Character context

- The engineering endpoint now uses `LORE_LIBRARY` for built-in character profiles, not the optional `CHAR_DATA.lore` field (which caused `[Personality Settings]: undefined`).
- The selected Charta character uses its entire authored profile (identity, intro, personality, speech/behavior guidance). Its associated Charta world description and full canonical timeline index are injected; BanG Dream's built-in world and all canon periods are also identified.
- Only the active engineering character is injected. Unrelated custom character profiles are not included in the engineering prompt. Existing character IDs and saves are unchanged.
- Settings → AI → **OFFICINA · 角色工程师设定** contains TWO independent, opt-in toggles. **核心人物关系** includes all-era relationship records and notes. **主要经历** includes all-era experience records and notes. Both default to OFF to reduce token consumption; these toggles do not filter base identity, personality, introductions or characterization guidance. No story-mode chronology gate is applied to these opt-in engineering details.
- User-facing code-file instructions still allow `<file name="...">...</file>` for actual executable/configuration files, never ordinary prose. `<thinking>` is no longer requested by the engineering-mode system prompt.
- Engineering character selection in the right sidebar gains **按世界观筛选**, default **全部世界观**. The character card displays its actual Charta world, BanG Dream, or 通用角色. Old persona variant buttons for Sakiko, Mutsu and Soyo have been removed; engineering uses canonical character names.

## Debugging Node's DEP0169 warning

`[DEP0169] url.parse()` is Node.js deprecating the legacy URL parser. It is **not** evidence of a failed model response, and the exact caller cannot be identified from the warning alone. In PowerShell run:

```powershell
$env:NODE_OPTIONS="--trace-deprecation"
npm run dev
Remove-Item Env:NODE_OPTIONS
```

The stack trace usually identifies whether the invocation originates in Shiorivia code or a third-party package. Do not assume it was caused by the Next.js security upgrade, and do not suppress this warning permanently without locating the source.

## Local regression checks

```powershell
npx tsc --noEmit
npm run build
```

Manual test: select Mutsu in engineering mode and send `睦，你好~`. Terminal request logging should display her actual base identity/personality rather than `undefined`, and output should resemble natural dialogue rather than a generic support agent. Then enable each lore toggle independently, verify that relationship/experience sections appear only when enabled, switch to a custom character tied to a Charta world, and confirm the chosen world's description and full original timeline are present.

## Per-conversation engineer binding and welcome UI

- New Officina conversations have **no selected character** (`characterId: ""`). The stage is empty and the background is neutral gray-blue. The header initially shows only **Officina**, and the composer, attachments and send action remain locked until a character is selected in the right sidebar.
- The initial system welcome is visual-only, localized to the UI language and identified by `modelName: "System"`. It is omitted from the API request and AI title-review context; the UI does not expose regenerate/edit actions on this welcome.
- Before the first user message, characters may be switched freely. The first Send prompts for explicit confirmation; cancellation preserves the draft and does not send. Confirmation sends the message and sets `engineeringCharacterLocked: true` on the session, persisting across reloads and saves. The selected card receives a lock badge and other characters become unavailable in this session. A new session starts unassigned again.
- Existing Officina sessions with any user turn are treated as locked even if they lack the new flag; existing chats keep their associated character and do not require migration.
- The shared Settings center now shows **OFFICINA · 角色工程师设定** only when opened from Officina. **文风优化** appears only in Via Lata or Tela. Neither option is shown in VIAE, Umbra or the mode hub.
- Both the chat endpoint and title summarizer explicitly pass Node's native `globalThis.fetch` into OpenAI-compatible SDK clients. This targets the supplied `url.parse()` deprecation trace; re-test the dev server because other dependencies could still issue the same warning.

```powershell
npx tsc --noEmit
npm run build
```

Manual smoke test: create a new Officina session; verify neutral welcome, no portrait and disabled input. Choose Mutsu, type a first message, cancel the confirmation (message remains unsent); confirm the next time (message sends, card locks). Reopen the session and attempt selecting Sakiko; role must remain Mutsu. Check terminal request logging: first AI request must contain the user message and selected character persona, but no original `modelName: System` welcome text. Check a pre-existing engineer session, and each mode's settings sections.
