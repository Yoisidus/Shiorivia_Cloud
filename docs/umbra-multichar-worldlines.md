# Umbra multi-character conversations · Shiorivia Local

This document describes the **Local** implementation in `seemoon1/Shiorivia`.

## User entrypoint update (2026-11-21) / 聊天世界线入口

- The localized **Configure worldline** action above Umbra's locked composer now directly requests the existing **Umbra** worldline dialog, including when the left sidebar is already open. The editor continues to live in the left sidebar and uses the same `onSaveChatWorldline` handler; this is a presentation/navigation fix, not a new worldline format.
- The separate **UMBRA · WORLDLINE** card at the top of the left sidebar still opens that same editor. With no valid worldline, the right sidebar displays a localized empty-state explanation, and the composer stays disabled until a compatible character is selected.
- QA: first check the missing-worldline state with the sidebar closed, click the composer action, save WORLD/ERA/PERIOD, select a character, and repeat with the sidebar already expanded. Verify the pop-up and the composer gate in `zh-CN`, `zh-TW`, `en`, `ja`, `ko`. The change is **source-verified**, not yet browser-tested.

See [Local five-language QA](localization.md).

## Umbra flow

- New Umbra conversations start without a selected character. A localized **System** welcome instructs the user to choose a worldline from the top of the left explorer and then a character from the right sidebar. The composer is locked until a valid WORLD / ERA / PERIOD and eligible active character are selected.
- The right cast sidebar shows a placeholder until a worldline exists. After configuration it lists only characters from the current main world and explicitly enabled secondary worlds (plus universal characters if that worldline option is enabled). Cards show their origin world.
- Users can switch the active chat character freely within the same conversation. Each generated assistant message stores `characterId` and uses that saved ID's portrait/name, not the presently active character's portrait.
- Before each AI request, historical user messages are labelled with their addressee and historical assistant responses with their original speaker ID/name. The new system prompt states the current speaker and last assistant speaker, enabling the new character to react naturally to what a previous character said without claiming the previous speaker's words.
- Only the **current speaker** receives full biography, period-limited by its own worldline knowledge cutoff. Its STM and LTM are isolated under `chatCharacterMemories[characterId]`; other speakers' memories do not become the current speaker's first-hand experiences. The Memory Vault switches to the active character. Legacy chat STM/LTM are migrated to the originally selected character when a worldline is configured or the actor first changes.
- **Inline conversational memory:** after each visible Umbra response, the same model response emits one private `<turn_memory>{"stm":"...","ltm":null}</turn_memory>` record. Six turns accumulate STM for that speaker; on its seventh speaking turn, the model consolidates that speaker's STM and prior LTM into a new LTM. The UI strips memory tags during streaming. There are **no automatic summarizer calls**, including for missing STM or failed seventh-turn LTM consolidation. The affected assistant bubble instead offers a manually confirmed **补齐状态** action; the selected model returns metadata only while the input is locked. Success/failure feedback is shown and outdated results cannot replace a different speaker's updated memory. Regeneration does not append an additional STM slot.
- An active Charta self is supplied to Officina and Umbra requests as the user's optional identity. If none is active, the AI is explicitly told the other party is simply the user.

## Worldline policy

- All narrative spaces preserve the primary WORLD and original-canon AU baseline after saving. Canon ERA/PERIOD can advance only forward on the ordered stage list after the user unlocks the timeline. AU creative ERA/PERIOD can be freely edited by the user after unlock; AI cannot author those changes. Umbra never advances its worldline through model output. Existing secondary worlds may be appended up to the limit of three but not altered or removed.
- Shared worldline editors disable locked fields and validate the additive-only contract before saving. Worldline scene EVENT is still allowed to change in story contexts. VIAE's route editor uses the same contract.
- Existing routes/sessions remain readable using the prior compatibility layer; the change does not rewrite or delete old archives.

## Officina output recovery

- Character engineer prompts still allow normal conversation. Only when a complete code file/component/script is requested but the reply lacks the required `<file>` block, or file blocks are unclosed, is the message flagged as potentially incomplete.
- A **确认补全** button appears under that answer. Clicking requires confirmation and sends one explicit follow-up request to the same current character engineer and selected model. It does not automatically issue extra model requests for greetings or unambiguous plain text.

## Visual polish

- Image Studio settings use the neutral white/slate style of Settings Center.
- Left model-selection and right character-world filters have neutral white surfaces and subtle cool-grey borders, removing most legacy light-sage accents.
- Umbra uses a restrained botanical green for its worldline selector and character context.

## Suggested verification

```powershell
git switch main
git pull --ff-only origin main
npx tsc --noEmit
npm run build
```

Manual checks:
1. Fresh Umbra has an empty character and a locked composer. Save a worldline and choose a character to unlock it. Do not send the visual-only welcome to AI.
2. Chat with Mutsu, switch to Sakiko and ask her opinion of Mutsu's last message. Verify each assistant bubble keeps its original portrait, the provider request explicitly labels the speaker and previous speaker, and each character has its own Memory Vault content.
3. Enable one secondary world and verify its characters become available. Add another later. A canon ERA/PERIOD can only advance after unlocking and cannot move backward; AU ERA/PERIOD are user-editable after unlocking. Deleting an established secondary world or changing its original-canon baseline must still fail.
4. In Officina request a complete source file using a model known to sometimes omit file markup. Confirm the manual completion button appears, does not dispatch when cancelled and can dispatch after confirmation. Ordinary greetings must not produce it.
5. Inspect Settings Center and the white sidebar model panel for aligned background/border colors.
