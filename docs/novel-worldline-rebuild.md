# Novel mode · worldline and chapter editor integration (Local)

This change updates **Shiorivia Local**, not Shiorivia_Cloud.

## 2026 Local chronology additions

- Each newly generated `novel_state` now contains `era` and `period` alongside environment, event, legacy `nextSceneCastIds:[]`, choices and danmaku. For **canon**, the model repeats the current stage or proposes a later valid stage only when the chapter actually advances time. For **AU**, the model must repeat the user-saved ERA and PERIOD verbatim; no model-generated AU date change is allowed. The server supplies the ordered canon stage list and active-locale descriptions.
- The Tela worldline editor has a deliberate **解锁时间线** control. In canon, manual edits can only move forward; in AU, the user can freely edit both creative ERA and PERIOD regardless of chronological order. The main world, AU original-canon baseline and saved secondary worlds remain protected. Old novel archives without era/period in state still load.
- A participant Charta self is an ordinary independently active fictional character. Its lore/color come from its own Charta snapshot, not from the candidate cast roster; its presence does not mandate a central viewpoint or a turn-by-turn player command.

## Five-language writing workflow / 五语言小说使用提示 (2026-11-21)

Tela's UI now localizes the worldline and cast prerequisites, six explicit creative presets, Environment/Event/Style controls, archive notices and confirmation dialogs. The shared first-chapter cast selection is optional and becomes read-only once writing starts. Switching locales **does not translate saved prose, an existing Environment/Event/Style draft, custom character names, or prior chapter JSON**. Newly initialized default style follows the selected UI language; translated preset text is inserted only when the user explicitly chooses that preset.

Test the first-chapter disabled state, WORLD/ERA/PERIOD setup, optional cast and self role, preset insertion, JSON / DOCX round-trip and chapter navigation separately in each locale. These items are covered by a source-level audit; a full browser/TypeScript/build regression check is still outstanding. See [Localization and QA](localization.md).

## Novel worldline and cast

- Novel uses the same WORLD / ERA / PERIOD chooser as Story, including mandatory AU baseline ERA/PERIOD.
- Choose the worldline from the novel sidebar, directly above the next-chapter cast selector.
- The **登场角色** cast picker is editable only before the first chapter. The user can pin 0–6 first-chapter characters; each chapter then independently asks the selected model for a complete 0–6 cast list, resolving only those characters' full lore before prose generation. The saved `storyNextCastIds` field remains for Local JSON compatibility but is no longer a next-chapter forecast. The picker retains the six-character limit. Cross-world enablement and universal-character selection now belong to the shared worldline editor, never to the cast picker. The AI gets lore only from the current main world, up to three explicitly configured secondary worlds, and opt-in universal characters.
- Novel does **not** emit Story `<game_state>`. It ends each chapter with `<novel_state>` containing `environment`, `event`, legacy `nextSceneCastIds:[]`, embedded `choices` and `danmaku`. The separate cast lookup determines the **current chapter's** full-profile roster, which appears in the read-only cast panel after chapter one. Older JSON arrays remain readable.
- The selected current-chapter cast and worldline are saved on the novel session. Replacing the world with a different world clears the old cast selection and the optional self protagonist.
- Built-in BanG Dream character biographies and Charta's five-section profiles are injected through the same period-aware logic as Story. In AU, the baseline period is the knowledge cutoff.
- The **Story Role** card offers Observer (default; user is an outside director) and Participant. Participant is available only with a currently active Charta self compatible with the chosen world; the selected self is snapshotted in the novel session before writing begins and never added as an ordinary cast member. A world-neutral self receives unscoped data. The role locks after writing starts; unlike Via Lata, Tela has no selectable POV. Legacy novel drafts with a `selfId` continue to load as Participant when `storyRole` was not saved.
- No worldline means no chapter generation. Older novel saves can still open; they require a worldline selection before a new chapter can be generated.
- Invalid or omitted `<novel_state>` triggers one *state-only* recovery request. On failure, the finished prose and last valid state are preserved; the app warns instead of silently corrupting scene context. New state values and selected cast persist in the session JSON. Legacy `scenario` / `action` values still import as initial Environment / Event.

## Editor and appearance

- Default novel body length is **roughly 1000–2000 Chinese characters for Chinese prose, or comparable length in the selected UI language**. An explicit character/word count in Style overrides the default.
- **Environment** (location, weather, temperature, surroundings) and **Event** (what is currently happening) are required before chapter one; Style is optional. When a chapter completes, the AI updates both fields from the completed prose and predicts `nextSceneCastIds`. After the first chapter, manual changes require explicit confirmation.
- Novel worldlines only choose WORLD / ERA / PERIOD / AU baseline: the worldline Event field is hidden for novels; Story mode retains its own worldline Event.
- Six plot presets: two everyday, two melancholy, and two emotionally heavy. Presets update Environment/Event/Style only, not the worldline or cast. Once the novel has started, confirm an override before applying a preset.
- Novel archive JSON/DOCX import/export is an **independent card below** the complete AI Architect / Shared Model card. The JSON archive retains session role and self snapshots; old exports keep their legacy self ID fallback.
- Tela uses parchment as its only active UI theme. The sage-theme toggle and green palette have been removed; legacy archives with `themeMode: "sage"` or `"dark"` remain importable and are displayed in parchment. Subsequent edits persist `themeMode: "paper"`.
- The mini music player, novel archive panel, worldline editor and cast picker use parchment colors. Tela's hub card now uses a scroll icon with warm ink and parchment colors. The Auto DJ toggle remains removed from the novel sidebar; global Settings music control remains authoritative.
- Until WORLD / ERA / PERIOD (and AU baseline where applicable) is configured, Tela disables its director input, Continue and new-chapter generation and offers a direct link to the worldline editor. Both the chat hook and server also refuse generation without a valid worldline.
- The same optional writing-style optimization now applies to both Via Lata story prose and Tela novel prose, while state-only repairs, summaries, and non-story modes remain excluded. It must never rewrite `<novel_state>` or `<game_state>`.
- Participant self names render in the novel reading view with the same Charta theme-color logic as Via Lata.
- Completed chapters now include `choices:{fun,rational,radical}` and `danmaku:[]` directly in the final `<novel_state>` object, rather than standalone `<novel_choices>` / `<novel_danmaku>` tags. The choices are persisted per assistant message and displayed in clickable cards after the prose; legacy tags and old `> **Option 1**:` lines still work on imported JSON archives. The state block is not printed or exported as prose.
- Every generation saves a per-turn `novelStateBefore` checkpoint of the scene, selected next cast and STM/LTM memory. Deleting or rewriting the latest chapter restores that checkpoint while preserving the user-selected WORLD/ERA/PERIOD, story identity, outline and **Style**. The original scene is also saved in `novelInitialScene` for initial-chapter/old-format fallback. Old archives without snapshots cannot reconstruct arbitrary past AI states.
- `useImageGen=false` suppresses visualizer guidance and explicitly forbids model-produced draw tags; the reading view also hides the drawing action when image generation is disabled.
- **Tela output protocol consolidation:** chapter tag ordering, title metadata, optional draw/audio, `turn_memory`, integrated `novel_state.choices` / `novel_state.danmaku`, and next-chapter plot suggestions are governed by `src/lib/novelOutputContract.ts`. The app route appends this single contract after literary styling, cast lore, title context and other settings. `novelTurnMemory.ts` describes the six-STM/seventh-LTM memory algorithm only; `inlineTitle.ts` provides the title-review decision without duplicating the chapter tag order.
- **Participant identity:** a selected Charta self is an ordinary, active in-world ensemble character with a saved dialogue/thought color, not a forced central narrative viewpoint, blank player cursor, or permanent focal character. The narrator may shift to other characters as the chapter naturally develops.
- **Cast semantics:** the eligible roster lists possible choices, the color palette provides display-only names/hex values, and only the current `ACTIVE CHAPTER CAST` list receives full biographies. The session's archive-compatible `storyNextCastIds` carries the chosen current cast for display/continuity; the empty legacy `novel_state.nextSceneCastIds` must not erase it.
- **Plot choices:** `novel_state.choices` requests prospective *authorial narrative developments* rather than player commands or a forced next action by the Charta self. The local archive's pre-existing role and memory records remain compatible.
- The system prompt emphasizes novelistic momentum, non-OOC characterization and scene-based storytelling. Both regular chapter generation and state-only repair explicitly demand user-visible Environment/Event VALUES in the selected UI language; JSON keys and IDs stay stable.
- Tela's right-panel primary button is **编织新篇章**. Clicking a novel plot option opens a confirmation dialog before sending, while its **填入输入框** action populates editable director text without dispatch. Via Lata uses themed managed confirmation dialogs for **both** primary-card direct send and **填入输入框**; cancelling either has no effect.
- Tela participant identity may be selected before the worldline is configured when Charta has an active self. A later incompatible worldline resets the pre-start self rather than binding an invalid participant; the worldline and self must still be valid when generation begins.
- Environment/Event can be manually unlocked after confirmation, edited, then saved and **locked again**. Style stays independently editable.
- Shiorivia's four conversation spaces (Officina, Via Lata, Umbra, Tela) review AI-managed titles after turn 1 and every five subsequent user turns (1, 6, 11, ...). The title model gets the current title and recent context, returns `KEEP` when suitable, or a new title when stale; user-renamed titles and pre-existing unmarked custom titles remain protected.
- Tela now has a CSS-only **羊皮纸卷轴转场** for entering existing/new novels, resuming from the hub, and returning to the hub. The existing Local `curtainTransition` preference enables/disables the parchment effect without migrating preferences. The original curtain renderer remains available in Developer preview and for other effects. Both desktop and mobile render an opening/closing parchment with scroll rods and a centered TELA title. The novel STM/LTM memory archive is accessible from the **top toolbar** with live record counts; the tall right-sidebar memory preview is removed, and the original memory editor remains available.

## Local checks

```bash
npm run build
```

Manual smoke test matrix:
1. Novel without a worldline refuses generation with a helpful message.
2. Select BanG Dream T-3-4, choose one character, generate and check the terminal request for the time-limited full biography.
3. Set AU current period to an imagined future and baseline to T-3-4; late-canon facts must not appear as existing knowledge.
4. Add a custom Charta world, linked Charta character and linked self; verify their timeline-gated details enter the model prompt.
5. Change worlds; stale cast and incompatible self selections should be cleared. Cross-world eligibility is configured in the worldline modal, not in the next-cast picker. Configure three secondary worlds with separate canonical baseline ERA/PERIOD values; a fourth must be impossible. Unbound characters require the explicit universal-character switch.
6. Generate a chapter and check that <novel_state> is not printed in the reading pane, that Environment/Event update, and that the current chapter's cast comes from the model tool (not next-chapter prediction).
7. Try manually editing Environment/Event after chapter one (requires confirmation). The cast picker must be read-only after the first chapter; later casts come from the model lookup round.
8. Break the JSON or omit <novel_state> with a model and verify state-only recovery. If repair fails, the previous state must remain intact.
9. Export a novel JSON, import into a new session, verify worldline, novelState, cast, Style, parchment appearance and self draft selection. Also import an older JSON with scenario/action.
10. Try a Style field with `3000字` and another with no explicit count; check the two different length instructions.
11. Confirm six presets, archive contrast and miniature player colors under parchment. Older sage-tagged sessions should also display parchment.
12. Check global Auto DJ setting remains available although the novel-specific toggle is absent.
13. On a new novel with no worldline, verify the director input and both generation controls are disabled. Setting a valid worldline unlocks them.
14. In Story Role, Observer has no self injected; Participant is unavailable until a compatible Charta self is active. Select Participant, generate, switch Charta's active self, and verify the novel continues with its snapshotted identity and correct name color. Neither role can be changed after writing begins.
15. Import an older novel archive containing `novelDraft.selfId` but no `storyRole`; verify its selected self is still used and shown if available.
16. Verify style optimization changes the novel's prose instructions without contaminating its `<novel_state>` response or one-shot repair.
17. Confirm the Archive card is visually separate and below the complete AI Architect / Shared Model card.
18. Start with a custom worldline/Environment/Event and selected cast, generate two chapters, delete the latest assistant chapter and verify Environment/Event, next cast, memory and saved draft rewind to their PREVIOUS values. Repeat for the first chapter; the original scene must survive. Style must remain unchanged.
19. Regenerate the last chapter after its state changed and verify the next AI request uses the restored scene rather than the deleted chapter's scene.
20. With image generation OFF, generate with Gemini: verify the model does not emit image control JSON and the reading pane shows no image action. Re-enable and confirm optional on-demand illustration remains available.
21. Switch UI locale among zh-CN/zh-TW/en/ja/ko and verify Environment/Event, three choices and chapter text follow it, while `novel_state` JSON keys remain English.
22. Generate a chapter with `novel_state.choices` and optional `novel_state.danmaku`: cards and audience comments should display while structured tags remain hidden. Import older chapters with standalone `novel_choices` and legacy Option lines; suggestions should remain readable.
23. Verify the fixed parchment theme has readable contrast across action controls, chapter list, archive dialog and mobile sidebars; no sage theme switch remains.

24. Click any of the last Tela chapter's three option cards: confirm dialog must open; Cancel must not send; Confirm must dispatch exactly one continuation. Use **填入输入框** and check it only populates editable director text. In Via Lata, both the main card and the insert button must open distinct confirmation dialogs; cancel either without changing the chat or input.
25. Before selecting a worldline, enable an active Charta self and select Tela Participant; it must be selectable. Choose a compatible worldline and ensure identity persists; incompatible worlds must not silently keep an invalid self.
26. Generate a chapter, manually unlock Environment/Event, change both, use **保存并锁定**, and verify the fields become read-only again. Style must remain editable.
27. For each conversation mode (Officina, Via Lata, Umbra, Tela), use turn 1, then 6, then 11: check AI keeps an accurate title or replaces one rendered stale after deleting/restarting turns. A manually renamed title must never change. Also test old imported sessions without `titleAutoManaged`.
28. Toggle **Tela 羊皮纸卷轴转场** off/on in Developer settings. Enter, resume and exit Tela on desktop and mobile; only the enabled mode should play the parchment animation. The independent **Curtain** preview is still available.

29. With DeepSeek, generate two consecutive chapters: both must have a `<meta>` title; when the second header is missing, a one-shot chapter-title review should reuse an apt preceding title or create a new one when the scene changes. The session title is never overwritten by this recovery.
30. In Participant mode, let another character initiate interaction with the Charta self: the self should respond naturally like any other fictional cast member, including colored dialogue and thoughts, not merely appear in the three suggestions under `novel_state.choices`.
31. In main-world-only mode, verify color map and eligible character IDs contain only characters from the primary world; neither `User` nor `System` has a fixed color and universal characters are absent. VIAE should never receive a character-color map.
