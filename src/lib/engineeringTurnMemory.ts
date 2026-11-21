/** Keep inline Officina memory out of displayed text and persist it in local STM. */
export function extractEngineeringTurnMemory(text: string): { text: string; memory: string | null } {
  let memory: string | null = null;
  const clean = String(text || "").replace(/<turn_memory\s*>([\s\S]*?)<\/turn_memory\s*>\s*$/i, (_, raw: string) => {
    if (memory === null) {
      const value = raw.trim().replace(/[\u0000-\u001f]/g, " ").trim();
      if (value && value.length <= 2000) memory = value;
    }
    return "";
  });
  return { text: clean.trimEnd(), memory };
}
