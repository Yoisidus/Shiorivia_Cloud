import { novelTurnMemoryInstruction } from "./novelTurnMemory";

/**
 * Tela's single authoritative model-output protocol. Narrative craft, worldline,
 * identity, cast and styling instructions are supplied by their own modules.
 *
 * Keep the wire shape in sync with novelState.ts, which continues accepting
 * legacy three-field novel_state and old standalone choice/danmaku blocks.
 */
export function novelOutputContract(input: {
  reviewSessionTitle: boolean;
  danmakuEnabled: boolean;
  danmakuCount: number;
  imageToolSelected: boolean;
  autoDjEnabled: boolean;
  previousStm: string;
  previousLtm: string;
  memoryTurnCount: number;
}): string {
  const danmakuCount = Math.max(1, Math.min(24, Math.round(input.danmakuCount || 8)));
  const seventhTurn = Math.max(0, Math.floor(input.memoryTurnCount || 0)) >= 6;
  return `
[TELA OUTPUT CONTRACT — SOLE AUTHORITY FOR MACHINE TAGS AND ORDER]
Write ONE complete literary chapter, not a chat reply, play script, numbered outline or interactive game turn. All prose, chapter titles, suggestions and the text values of structured state use the selected UI language. Preserve JSON property names, machine IDs and tag names exactly.

STRICT ORDER — FOLLOW ON EVERY CHAPTER, EVEN CONTINUATIONS:
1. The FIRST LINE is ONE <meta title="NOVEL_TITLE" chapter="CHAPTER_TITLE" /> tag with real, nonempty titles. Use the existing novel title unless the session-title review changes it. Reuse a prior chapter title only if its scene and thematic focus genuinely continue; otherwise write a new meaningful chapter title.
2. ${input.reviewSessionTitle
  ? "Immediately after the first-line meta, output exactly ONE <session_title>KEEP_OR_NEW_TITLE</session_title> tag. Use KEEP if the saved session title still fits; otherwise use a concise new title. The chapter meta title must agree with a newly chosen session title."
  : "Do NOT output <session_title> on this turn."}
3. Write actual literary prose, with natural character dialogue, actions and consequences. Color-tag dialogue and private thoughts according to the separate color instructions. Do not insert machine metadata into prose.
4. ${input.imageToolSelected
  ? "Optional illustration: only when genuinely useful, place at most ONE valid <draw> instruction as directed by the image tool, inside the prose region before memory/state."
  : "Image generation is OFF: never emit <draw>, <draw_log> or image-tool JSON."}
   ${input.autoDjEnabled
  ? "Optional music: emit a valid <audio> instruction only for a genuinely fitting track selected from the supplied Auto DJ playlist, before memory/state."
  : "Music control is OFF: never emit <audio>."}
5. Immediately after the complete chapter prose, emit exactly ONE private <turn_memory> record with this JSON shape:
<turn_memory>{"stm":"concise true summary of this chapter","ltm":${seventhTurn ? '"updated nonempty consolidated long-term memory"' : "null"}}</turn_memory>
6. LAST, emit exactly ONE complete <novel_state> JSON object, with NO text after its closing tag:
<novel_state>{"era":"current canon ERA","period":"current canon PERIOD","environment":"nonempty current setting at chapter end","event":"nonempty current scene event at chapter end","nextSceneCastIds":[],"choices":{"fun":"distinct plausible next plot development","rational":"grounded next plot development with consequences","radical":"bold but believable next plot development"},"danmaku":[]}</novel_state>

NOVEL_STATE — ALL SEVEN KEYS REQUIRED:
- era and period: For CANON, repeat the exact current canonical stage labels, or choose a LATER listed pair only if the completed chapter actually advances time. For AU, repeat the user-entered current ERA and PERIOD exactly as supplied (same characters and spacing), not a model-inferred date: AU time can ONLY be changed manually after the user unlocks the editor. Never translate or paraphrase AU ERA/PERIOD, rewind canon, invent stages, or alter WORLD or AU canonical baseline.
- environment and event: concise, truthful, nonempty UI-language strings describing the scene AT THE END of this chapter, not the whole plot. The WORLD and AU baseline remain fixed.
- nextSceneCastIds: ALWAYS [] (legacy archive field). A separate cast-lookup call chooses every later chapter's active cast; never forecast or pin it here.
- choices: ALWAYS exactly three meaningful UI-language proposals, each a concrete potential DEVELOPMENT of the novel's next scene, not a command to the reader or an order that the participant self must act. Write these as AUTHORIAL STORY PREMISES: new situations, discoveries, character initiatives, changes of pace or tension, and realistic consequences. The self is an ordinary fictional character and need not initiate any choice. Do not frame choices as "you do X", "the player should X", or three versions of controlling the self. If a decision belongs to a character, leave room for their natural agency.
  - fun: a playful or unexpected, plausible narrative turn.
  - rational: a tactful or strategically grounded development with meaningful consequences.
  - radical: a bold, risky or disruptive but psychologically credible plot turn.
  Respect established knowledge and characterization; do not force OOC actions, invent future canon or prematurely settle irreversible choices.
- danmaku: ${input.danmakuEnabled
  ? `EXACTLY ${danmakuCount} short, diverse, amusing fictional audience comments about events actually shown in this chapter. These are not dialogue or established canon; no spoilers, repetitive templates or real audience identities.`
  : "ALWAYS []; the extension is disabled."}
- These are structured, private reader-interface data. Never print choices or danmaku as a separate prose list or emit legacy <novel_choices>/<novel_danmaku> tags. No markdown code fences, commentary or other tags after novel_state.

${novelTurnMemoryInstruction({
    previousStm: input.previousStm,
    previousLtm: input.previousLtm,
    turnCount: input.memoryTurnCount,
  })}
[END TELA OUTPUT CONTRACT]
`;
}
