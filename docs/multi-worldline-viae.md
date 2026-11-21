# Cross-worldline architecture · Shiorivia Local

This applies to **seemoon1/Shiorivia** (Local Edition), not Shiorivia_Cloud.

## Chronology and localized stage descriptions

- Via Lata, Tela and Umbra share the rose/parchment/mint time editor: each canonical period is labeled with its exact-locale description when one exists. VIAE uses the same data in its route editor. Existing sessions must explicitly unlock time before moving forward; backward shifts remain prohibited.
- **Umbra never receives a chronology-advance tool** and cannot update a saved worldline from AI output; only the user advances Umbra time. VIAE retains its existing optional private `worldline_update` handling for future VIAE-specific work; generated tags are stripped from visible chat and subject to canon stage validation.
- AU creative dates are unsorted freeform text. In the shared Via Lata/Tela/Umbra editor, the user can unlock and freely change saved AU ERA/PERIOD without stage-order validation. AI must echo rather than update them in Story/Tela; the original-canon baseline stays immutable. VIAE-specific changes beyond the shared validator are deferred.

## Worldline and cast boundaries

- Each Via Lata / Tela session and each new VIAE road has ONE primary WORLD and its current ORIGINAL (canonical) ERA/PERIOD or AU ERA/PERIOD with an explicit original-canon baseline.
- The cross-world switch is **off by default**, now located directly under the primary WORLD selector. Enabling it makes up to THREE other registered worlds available, each with its own required canonical baseline ERA/PERIOD to prevent characters knowing future events from their own lore. The primary world's ERA/PERIOD governs the scene.
- The separate "enable universal characters" switch is only shown within cross-world. It is **off by default**; unbound Charta characters are never eligible without it. When enabled, they become eligible for the per-turn cast lookup, but only the 0–6 actually selected characters receive full biographies.
- The **登场角色** picker no longer owns any cross-world toggle. The user may optionally pin permitted cast members for the first turn only; each later Via Lata/Tela turn uses an independent model cast-lookup round that can replace them. Each selected ID is validated against the current worldline before its full biography is injected.
- Worldline parsing checks unique world IDs, at most three secondary worlds, and that every secondary ERA/PERIOD baseline is one of that world's canonical stages. Old single-world snapshots remain readable.

## Charta character IDs

- The Charta character form now includes a required **Character ID** directly beneath character naming. It validates the format and case-insensitive uniqueness against built-in and other Charta character IDs, with live availability feedback.
- Character ID is persisted as **characterCode** (human-facing ID). The original immutable **id** (e.g. `charta-...`) remains the machine key in existing session relationships, portraits, archives and message protocols. AI prompts receive both the public character code and the stable machine ID; don't change existing machine references when editing the public character code.
- Previous local JSON files lacking `characterCode` inherit their former stable `id` as a compatible public code. Both client and server validate duplicates on save.

## VIAE localized sidebar action labels (2026-11-21)

The two left-sidebar entry buttons now show a **single translated verb** followed by the existing product name, avoiding text such as "Start a Semita path · Semita". The button pairs are `开启 Semita` / `创建 Compitum` (zh-CN), `開啟 Semita` / `建立 Compitum` (zh-TW), `Start Semita` / `Create Compitum` (en), `始める Semita` / `作成 Compitum` (ja), and `시작 Semita` / `만들기 Compitum` (ko). The action keys are `viae.actionOpen` and `viae.actionCreate`. The full headings inside route creation still use `viae.startDirect` / `viae.startGroup`; persisted `direct` / `group` values are untouched. Verify the labels after switching each of the five locales; browser testing is still pending.

See the [Local five-language QA checklist](localization.md).

## VIAE routes

- The new VIAE route creation layout is **road type → road name → worldline editor → communication role → world-filtered travelers**. The inline editor uses a minimalist white, slate and warm-gold palette.
- Participant mode is unavailable without the currently active Charta self. Observer can be selected independently.
- VIAE uses the same main/secondary worldline rules; when multiple worlds are enabled, the traveler picker offers an **all worlds** default and per-world filtering. Each traveler shows their origin world. The route-management member add/remove interface also respects world eligibility.
- Each new VIAE `limeGroups[]` entry records `storyWorldline`. The legacy `reality` / `timeline` / `auContext` keys are kept in place for older readers and older saves; a legacy road without a full worldline receives an in-memory Bang Dream fallback instead of a destructive migration.
- On EVERY VIAE AI request, only the group's **fixed member IDs** receive character biographies, scoped to their OWN world's selected canon/AU baseline. VIAE does not depend on Via Lata/Tela next-cast prediction, and receives **no color map**. When in Participant mode, the active Charta self is available as identity context, not a newly invented cast ID.

## VIAE English prompt and inline memories

- VIAE's default system prompt is written in English for both Semita and Compitum. Character phone messages remain in the selected UI language, with authentic individual voices. The JSON `<viae_chat>[{"charId":"...","text":"..."}]</viae_chat>` protocol is unchanged; older `<lime_chat>` archives remain readable. Observer scene directions never become messages on the characters' phones, while participant messages use the selected in-world phone viewpoint.
- Each road stores STM/LTM independently in existing `limeGroups[].stm`, `ltm` and `turnCount`. The new model output sequence is `<viae_chat>` → `<turn_memory>` → optional `<worldline_update>` **last**. Chat bubbles never display either private metadata block; if the canon ERA/PERIOD changes, the change must move forward in the original stage order.
- Six complete interactions add STM entries; the seventh consolidates them plus the prior LTM. There is now **NO automatic summarize fallback**: malformed chat JSON, missing STM or missing seventh-turn LTM flags the affected reply for a **manual confirmed 补齐状态** call to the active provider/model. During repair, the input is disabled, with success/failure notifications. Only the last reply of the same road may be updated; other paths and valid existing memory remain unchanged. Regeneration does not append a duplicate memory entry.
- VIAE retains fixed-member lore injection and the user-selected shared context budget. The shared presets are now 64K, 128K, 256K (default), 512K and 1024K; the actual model/provider's supported context size still applies. No automatic truncation of a member's biography is introduced by this feature.

- VIAE now provides a visible **保存到本地** button in its left sidebar, calling the shared manual disk-sync workflow. VIAE data is included in its original Local session storage structure, not a separate export.
- **Message editing and refresh:** only **user-authored chat messages and outsider director notes** can be edited through the VIAE-themed confirmation and multi-line editor. **AI-generated character bubbles are deliberately not editable**, to avoid silently corrupting role interactions and saved STM/LTM; their edit buttons are commented out and the engine also rejects assistant-message edits. Historical user edits do not automatically regenerate replies or memory, and the confirmation warns that the Memory Vault may need review. Editing a user prompt flags its immediately following assistant reply as stale.
- The latest AI response now has a **confirmation before refresh**. New turns store an optional `viaeTurnBefore` snapshot on the assistant message containing previous STM/LTM, turn count and primary chronology. Confirmed refresh uses this snapshot to remove the old turn's memory/time changes before calling the model again; the new model reply generates its own STM/LTM and any forward chronology change. If refresh fails or the user stops it, the original response and state are restored. Old archives without this checkpoint stay readable, editable **and refreshable** after a clear confirmation. For these older replies, the regenerated visible chat replaces the prior reply while existing STM/LTM and chronology remain unchanged (they cannot be safely rewound); users are explicitly warned to review the Memory Vault. The editor and regenerations are locked during active model requests.

## Novel behavior

- The novel system prompt requires first-line `<meta title="..." chapter="..." />` on **every chapter**. Similar scene/theme can keep the prior chapter title; a material focus change should use a different chapter title.
- If the provider omits that tag, the chapter engine makes a focused `chapter_title` comparison request and inserts a valid title header, falling back to the previous title/numbered chapter if recovery fails.
- Participant self is a fully narratable character: AI writes natural in-scene speech/actions/reactions/character interiority; user's three next-step suggestions are higher-level editorial direction and must not be required to authorize ordinary exchanges. Keep all reactions in character.

## Suggested local checks

```powershell
git switch main
git pull --ff-only origin main
npx tsc --noEmit
npm run build
```

Manual acceptance: create an original world with two characters, add three secondary worlds with differing cutoffs; verify a fourth cannot be added; switch the universal toggle and check available cast and prompt lore. In VIAE verify world filter and badges, direct/group traveler counts, no-participant-without-self, per-route memory and fixed-member AI lore. Import an old Charta archive and an old VIAE road to confirm they load without changing internal IDs. Re-run a two-chapter DeepSeek novel in Participant mode with an in-scene interaction and confirm title and self reaction.
