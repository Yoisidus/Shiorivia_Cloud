# Model selection · Shiorivia Local

## One global active model per provider

All five spaces (Officina, Via Lata, Umbra, Tela and VIAE) share **one active provider and its selected text model**. There is no baked-in model ID and no silent fallback in either chat or summarization server endpoints.

- New installations and old preference files without explicit model selections start with **no model selected**, even if one or more providers are configured.
- Selections are stored under `providerModels` in `shiorivia_local_preferences_v1`. Each supported provider has either a selected catalog model or a user-entered custom model ID. The record is global, not tied to a chat session. Selecting another provider restores **only that provider's previous selection**; if none exists it stays blank.
- Clearing the selected model removes only that provider's record; other providers' saved choices remain untouched. The independent `shiorivia_saved_models_v1` list continues to hold the user's *library of saved manual IDs*, not automatically selected models.
- Pressing Send without a selected text model displays a one-button `window.alert`: acknowledge with OK, then pick a model. Do not send a request or clear the composed text. The shared chat engine (Officina/Via Lata/Umbra/Tela), the Tela chapter action, and VIAE's send engine enforce the same rule.
- Both `/api/chat` and `/api/summarize` reject empty model names, even if a client bypasses the UI. No provider-specific hardcoded fallback remains.
- This change does **not** replace independently configured image-generation models or TTS providers.

## Custom providers and presentation

- `custom_1` … `custom_4` **never query a remote /models endpoint**. The backend catalog endpoint returns `{ groups: [], source: "manual" }` for them, and Officina/Via Lata/Umbra, Tela and VIAE skip live catalog loading. They show only a custom model text field and the user's saved manual model IDs.
- Built-in DeepSeek, Google and OpenRouter catalogs retain their existing optional live queries and offline fallback lists; clicking a catalog model still requires explicit choice.
- The model panel inside the white conversation explorer uses white surfaces and subtle slate borders. Settings → Officina's character-engineer details now use the same white cards, neutral dividers and typography as adjacent settings.
- The initial unassigned Officina header displays **Officina** with the selected global model underneath (or “尚未选择模型 · Select model”). The neutral introductory system message is deleted from the conversation as soon as the first real user message is sent; if selection is incomplete or a confirmation is cancelled, the greeting stays visible. A visual-only system greeting never enters model history.

## Checks

```powershell
git switch main
git pull --ff-only origin main
npx tsc --noEmit
npm run build
```

Manual acceptance: start with an unset model; select an Officina character, type a message, click Send and dismiss the single-OK missing-model alert; the draft and welcome should remain. Select a model and confirm first send; the welcome should disappear and the selected model should display below Officina. In a different space, the same provider/model should appear. Switch from DeepSeek to Google or a custom provider: no model from the previous provider should leak. Select a new model for the new provider, switch away and back and verify its choice is restored. With custom providers, no remote /models request or “Live models” block should appear. Recheck a previous session and its model selector.
