/**
 * Via Lata's single canonical game_state contract.
 * Narrative craft and role/worldline data are intentionally kept elsewhere.
 * State-repair requests use their own short extractor prompt.
 */
export function storyOutputContract(input: {
  danmakuEnabled: boolean;
  danmakuCount: number;
  role: "participant" | "observer";
  hasPov: boolean;
}): string {
  const count = Math.min(24, Math.max(1, Math.round(input.danmakuCount || 8)));
  const protagonistExample = input.role === "observer" && !input.hasPov
    ? "null"
    : '{"name":"...","timeDesc":"...","environment":"...","temperature":"...","clothing":"...","sensation":"...","innerState":"..."}';
  const danmakuExample = input.danmakuEnabled
    ? '["针对当前剧情的机智短评", "从另一角度吐槽的短评"]'
    : '[]';

  return `
[STORY GAME STATE — SOLE STRUCTURED OUTPUT CONTRACT]
After writing the immersive story prose, append exactly ONE complete <game_state> JSON object, outside <thinking> and after any <session_title> metadata. It must be the LAST output block. Save sufficient output room for the entire object.
These fields describe current dynamic state; static biography, established worldline and historical canon belong to supplied setting data, not generated state.

Required JSON shape (placeholder values show types only, NOT actual story facts; replace every example with current scene data and NEVER emit placeholder strings):
<game_state>
{
  "protagonist": ${protagonistExample},
  "sceneCastIds": [],
  "nextSceneCastIds": [],
  "character": [],
  "suggestions": {"fun": "有趣且可信的后续行动", "rational": "合乎情理的后续行动", "radical": "大胆但不违背角色的后续行动"},
  "danmaku": ${danmakuExample},
  "timeline": {"era": "", "period": "", "event": ""},
  "music": null
}
</game_state>

- All eight keys are mandatory; maintain exactly these object/array shapes. Use valid JSON, never markdown fences, commentary or an array of {tag,text} suggestions.
- protagonist: this field denotes the session’s status-view owner only; it does NOT force the novelist or narrator to keep their perspective as the center of every scene. In observer mode without a selected POV use null; in participant or chosen-POV mode use an object with exactly SEVEN strings: name, timeDesc, environment, temperature, clothing, sensation, innerState. Use "" for genuinely unknown details. Protagonist.environment describes the protagonist's present location.
- character: other in-world characters ONLY, NEVER the active self or selected POV. Each entry identifies a known id and name and may include clothing, shoes, bodyState, legState, innerState and numeric affection, Possessiveness, Obsession, Lust. Relationship numbers describe the TARGET character's feeling TOWARD the active self/POV, never the reverse or self-to-self. Do not invent absent status or impossible knowledge. No age or gender in live status objects.
- sceneCastIds: IDs of characters actually on stage in the current scene. nextSceneCastIds is a legacy archive compatibility field: always emit [] because the NEXT response has its own independent cast-lookup round. Use known eligible IDs only for sceneCastIds; never invent IDs or include the participant self. Empty arrays are valid.
- suggestions: three distinct, specific NEXT-SCENE developments that respect the active canon/AU period, personality, knowledge and causality; fun is playful and surprising, rational is grounded and tactful, radical is consequential but believable. For observers, use third-person director commands making characters DO something, not commands to the human observer to watch or wait; for participants, use actions the chosen self can plausibly take. No forced OOC acts, future spoilers or repeated vague suggestions.
- timeline: For ORIGINAL CANON, copy the exact established ERA/PERIOD or propose a later valid pair from the ordered source stages ONLY when this completed scene advances time. Never rewind or invent stages. For AU, reproduce the user-authored ERA and PERIOD verbatim, character for character, from CURRENT STORY WORLDLINE: NEVER translate, paraphrase, rename, advance or infer these two fields. Only the user can edit AU time after unlocking the editor. AU baseline and WORLD remain fixed in all cases. event is a concise summary of what happens at the scene endpoint. The client validates dates; do not attempt to change AU time.
- music: use only the separate Auto DJ instructions if enabled; otherwise null.
- Never add top-level environment, age, gender, live2d or effect fields. Background, Live2D and cinematic effects are not generated game-state commands.
- Relationship metrics (0–100) describe the TARGET character's state toward the active self/POV, based on demonstrated events, not a moral judgment or a generic romance score:
  - affection = 好感度 / fondness and emotional regard, not automatically romantic love. Warm trust can be strong without desire.
  - Possessiveness = 独占欲 / urge to claim exclusive attention, jealousy and control; may exist without affection and is not automatically healthy.
  - Obsession = 病态程度 / unhealthy fixation, compulsive preoccupation, dangerous psychological deterioration. Do NOT confuse it with intensity of ordinary affection, and do not romanticize coercion.
  - Lust = 情欲 / sexual desire and physical attraction. This is NOT intimacy, trust, relationship closeness or affection. Desire may rise independently of affection, including conflicted or unreciprocated desire; model the character's established orientation, circumstances, boundaries and consent. Lust is NOT permission for sexual acts.
- Values should meaningfully track the actual scene: subtle moments can change scores slightly; an explicit decisive shift can change scores markedly. Do not systematically understate emotions, but do not inflate numbers without narrative evidence. The app smooths abrupt swings for continuity; Obsession retains inertia.
- ${input.danmakuEnabled
      ? `danmaku: exactly ${count} distinct, short, genuinely FUNNY fictional audience comments grounded in this scene. Use strings (roughly 5–28 Chinese characters for Chinese output); vary playful teasing, surprise and perceptive reactions. They are NOT dialogue, real viewer identities or canon facts. No repetitive templates or future spoilers. Do not copy the sample strings.`
      : 'danmaku: always [] because this extension is switched off.'}
- When facts are uncertain, prefer empty or null placeholders rather than inventing story state; never omit a required field.
[END STORY GAME STATE]
`;
}
