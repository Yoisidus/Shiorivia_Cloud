/**
 * Story/Tela dynamically colored dialogue. This is presentation only; names
 * and hex colors come from the currently eligible world, not the chosen cast.
 * Merely having a color mapping never grants a character stage presence/lore.
 */
export function storyColorRenderingInstruction(colors: Record<string, string>): string {
  const safeColors = Object.fromEntries(Object.entries(colors)
    .filter(([name, hex]) => typeof name === "string" && name.length <= 120 && /^#[0-9a-fA-F]{6}$/.test(hex))
    .slice(0, 100));
  return [
    "[STORY / TELA DIALOGUE COLORS — PRESENTATION ONLY]",
    'Spoken dialogue uses {{HEX_CODE|“quoted dialogue”}}; character private thoughts use {{HEX_CODE|（thought）}}.',
    "Use the exact hex code for a speaking or thinking character. Keep narrative prose and metadata uncolored. This color map is NOT the active cast list.",
    "Participant-self dialogue and private thoughts use the separately supplied self hex color; the self is not an extra roster ID.",
    "The map includes eligible-world identities for rendering ONLY. A mapped character is NOT necessarily appearing in this chapter, and a color entry is NOT a biography or permission to invent their facts. Only the independent ACTIVE CAST profiles provide full lore.",
    "Eligible-world display palette (NOT a cast roster): " + JSON.stringify(safeColors),
    "[END STORY / TELA DIALOGUE COLORS]",
  ].join("\n");
}
