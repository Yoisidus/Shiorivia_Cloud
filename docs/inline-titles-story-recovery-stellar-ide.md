# Same-response titles, story state preservation and stellar Officina IDE

## Root cause: Hydrogen's valid state caused an invalid repair

A model's `<thinking>` block can contain the literal text `<game_state>` while describing its output plan. The previous parser used the first opening tag and the final closing tag, accidentally consuming everything in between: the actual prose and the real, valid state. The backend then invoked an unnecessary state-only recovery and the old recovery branch removed the incorrectly matched span, leaving the user with the thinking preamble but no story.

The shared story response parser now:
- Removes a **closed** model thinking preamble from story and novel output before state/title parsing.
- Selects the **last complete** `<game_state>` block outside that preamble.
- Validates normalized JSON before deciding whether a repair is needed. A valid block with `protagonist`, `sceneCastIds`, `character`, and all three suggestions does **not** cause an extra model call; `danmaku: []` is valid.
- On a genuinely malformed/missing block, preserves the story prose and replaces/removes only a trailing state region. If recovery is unavailable, keeps the prose and the previously saved state rather than destroying the narrative.
- Logs errors from malformed story JSON to make future provider differences diagnosable.

When testing in dev, include a reasoning preamble that mentions `<game_state>` before a valid JSON state, and verify the final structured state remains intact.

## Inline titles across Officina, Via Lata, Umbra and Tela

Title updates are requested in the **same model response** as the real content. They are never requested in a later background `/api/summarize` call.

- On user turn **1, 5, 9, 13…**, if the session title is still auto-managed, the same prompt requests `<session_title>NEW_TITLE_OR_KEEP</session_title>`. `KEEP` leaves it unchanged. User-renamed session titles are never overwritten.
- The model receives the currently saved session title, recent conversation context and available STM/LTM when reviewing it. New title metadata is stripped from the displayed response and applied only while the expected session/turn/title remains current.
- Tela still requests a **separate chapter title every chapter** via its first-line `<meta title="..." chapter="..." />` tag; the four-turn review only concerns the *overall session/book title*. If a provider omits chapter meta, the client uses a local prior-chapter/ordinal fallback **without making another API request**. On the first chapter, an updated session title is reflected in chapter meta.
- Built-in state extraction and the novel chapter renderer continue to parse their own tags independently. The title parser deliberately ignores `<session_title>` examples embedded in prose/code.

## Engineering memory

Officina now explicitly requests a trailing `<turn_memory>` containing the current user's goal, work done, decisions and follow-ups. It is stripped from the visible response and written into STM. If the chosen model skips the tag, a short factual entry is derived from the already received user message/answer **locally**, without a hidden model call. Older STM records roll into LTM once the local six-entry STM window fills.

This is distinct from the existing async *memory* summarization in story, novel and character-chat modes; only title generation and recovery of chapter titles have had their separate model calls removed.

## Officina IDE

- The modal is now approximately Settings Center size (960px max width) with a taller editor, full-screen still available.
- Replaced flat dark-gray/green with a dark-blue and violet starfield-inspired theme, cool slate details and blue-violet console accents.
- Every file in the left explorer has a `…` menu with **下载** (download as original file name) and **删除** (confirm, then update the saved repository immediately). The delete action works even outside editing mode; creating/editing/saving code still works as before.

## Local checks

```powershell
git switch main
git pull --ff-only origin main
npx tsc --noEmit
npm run build
```

Manual verification: reproduce the provided Hydrogen story where the thinking section mentions `<game_state>`. One visible response should contain all story prose and correctly updated state, without an extra state-repair request. For each of the four modes, run a fresh first turn and the fifth turn, verify the title is reviewed in that response, then manually rename a session and ensure it stays fixed. For Tela, verify each chapter has a title without any `chapter_title` backend request. For Officina, check that Memory Vault receives an entry after a response and that file download/delete work in the IDE.
