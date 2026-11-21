# Unified context window · Shiorivia Local

## Motivation and scope

Before this change, chat context was truncated multiple times: the shared client reduced history to 20 messages; the server then reduced story mode to around four messages, novels to six, Officina to eight recent messages plus a leading message, Umbra to 24, and VIAE to 18. Those fixed limits prevented modern models from using long conversational context, even for short turns.

**Now all five modes use one token-budgeted, contiguous recent-history selector**, applied on the server **after** each mode's system prompt, character/worldline data, and on-demand IDE inspection have been prepared.

## Global preference

Settings Center → **通用设置** → **默认上下文窗口**:

| Available target | Description |
| --- | --- |
| 8K | Lightweight requests; can be too small for large lore |
| 16K | Small-medium context |
| **32K (default)** | Conservative default for general-purpose models |
| 64K | Longer histories |
| 96K | Large histories |
| 128K | Maximum configurable target for this local UI |

The choice is stored as `contextWindowTokens` in the existing `shiorivia_local_preferences_v1` object. Older preferences safely fall back to 32K. It is shared across providers and modes, but **does not change a model's provider-defined maximum context window**.

The budget includes the system prompt, extra character/worldline/code context, prior messages, protocol overhead, and a reserved output allowance of 20% (minimum 2K, maximum 8K). A UTF-8 byte estimate is used rather than claiming an exact tokenizer count. Individual providers may tokenize differently.

**Selection policy:** include the latest complete message, then preceding contiguous messages until the budget is reached. Do not split individual user/assistant messages, do not insert gaps to cherry-pick old history, and do not silently truncate the newest message. If even system instructions plus the latest message cannot fit, the API returns HTTP 413 with a clear error telling the user to enlarge the window or shorten context. Context selection never deletes or rewrites the saved conversation.

## Mode behavior

- **Officina:** use full available conversation history plus on-demand IDE code inspection. The standalone engineering STM/LTM generation, hidden `<turn_memory>` expectation, memory prompt injection, and Memory Vault entry are disabled. Existing old STM/LTM fields are retained in saved sessions for backwards compatibility and can still be exported, but are no longer used by engineering requests. The independent Charta **核心人物关系** and **主要经历** opt-in lore switches are *not* memories and remain available.
- **Via Lata (Story):** full available recent narrative messages + existing STM/LTM + timeline and game-state constraints.
- **Tela (Novel):** full available recent chapter/history messages + existing STM/LTM + persisted worldline, chapter state and narrative settings.
- **Umbra (Chat):** full available multi-speaker transcript + per-character STM/LTM, preserving role/actor attribution.
- **VIAE:** full available road transcript + road-level STM/LTM. The earlier hard-coded 18-message cap is removed.

Dedicated state-repair and summarization calls remain focused requests; the global budget applies to normal chat turns, not to unrelated short, deliberately structured helper requests.

## Prompt caching strategy

Supported providers such as OpenAI and Gemini can automatically cache **repeated prompt prefixes** on eligible models, according to their own mechanisms and pricing. Shiorivia retains the order of stable system and character instructions ahead of changing per-turn metadata and conversation content, and sends the actual multi-turn transcript through their normal APIs.

There is **no local persistent KV prompt cache**, no user-visible guarantee of a cache hit, and no universal `cache_control` or provider-specific parameter forced upon unknown custom OpenAI-compatible gateways. A provider might not support caching, or changing the active role/worldline may invalidate a prefix. Longer requests may increase billed tokens.

## Local validation

```powershell
git switch main
git pull --ff-only origin main
npx tsc --noEmit
npm run build
```

Manual smoke test:

1. Set 32K in Settings Center, reload, verify persistence in all spaces.
2. In each mode, use a conversation with more than 24 short messages. Enable terminal request logging and verify the model sees messages older than the former fixed 4/6/8/18/20/24 limits when the budget permits.
3. Lower the window to 8K and create a long conversation. Verify the oldest messages are omitted without deleting stored history and the newest message remains intact.
4. With extremely large persona/worldline plus latest message, verify HTTP 413 and an explanatory error instead of malformed/truncated requests. Raising the window should allow the request on models that support that context size.
5. In Officina, confirm Memory Vault is hidden, no `<turn_memory>` protocol is requested, and historical session STM/LTM is preserved in exported archives but not sent to the model.
6. In Story, Tela, Umbra and VIAE, confirm memories still summarize as before. In Umbra, verify each speaker's memory remains separate.
7. Observe any real prompt-cache usage metrics offered by your chosen provider. Cache savings cannot be asserted from the Shiorivia settings slider alone.

**Verification limit:** Structural source checks and the added regression test do not replace an actual TypeScript/Next.js build or model/provider smoke tests in your Windows environment.
