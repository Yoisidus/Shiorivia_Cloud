"use client";
import { useCallback, useEffect, useState } from "react";
import { CHAR_DATA } from "../data/char_config";
import { browserRead, browserWrite } from "../lib/browserStore";
import { CHARTA_STORAGE_KEY, parseChartaCharacter, type ChartaCharacter } from "../lib/charta";

const KEY = "charta:characters";
export function useChartaCharacters() {
  const [characters, setCharacters] = useState<ChartaCharacter[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let entries = (await browserRead<unknown[]>(KEY, [])).slice(0,100).map(parseChartaCharacter);
        // Migrate legacy browser-only Charta data; never delete before a verified write.
        if (!entries.length) {
          const legacy = localStorage.getItem(CHARTA_STORAGE_KEY);
          if (legacy) {
            const parsed = JSON.parse(legacy);
            if (!Array.isArray(parsed)) throw new Error("Invalid legacy character data.");
            entries = parsed.slice(0,100).map(parseChartaCharacter);
            await browserWrite(KEY, entries);
            localStorage.removeItem(CHARTA_STORAGE_KEY);
          }
        }
        if (alive) { setCharacters(entries); setLoaded(true); setError(""); }
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Unable to load browser Charta."); }
    })();
    return () => { alive = false; };
  }, []);

  const save = useCallback(async (item: ChartaCharacter): Promise<boolean> => {
    if (!loaded) return false;
    try {
      const valid = parseChartaCharacter(item);
      const code = valid.characterCode.toLowerCase();
      if ([...CHAR_DATA, ...characters.filter(c=>c.id!==valid.id)].some(c =>
        c.id.toLowerCase() === code || ("characterCode" in c && String(c.characterCode).toLowerCase() === code)))
        throw new Error("角色 ID 已存在");
      const next = [valid,...characters.filter(c=>c.id!==valid.id)];
      if (next.length > 100) throw new Error("Too many Charta characters.");
      await browserWrite(KEY, next);
      setCharacters(next); setError(""); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Browser save failed."); return false; }
  }, [characters,loaded]);

  const remove = useCallback(async (id:string):Promise<boolean> => {
    if (!loaded) return false;
    try {
      const next=characters.filter(c=>c.id!==id);
      await browserWrite(KEY,next);
      setCharacters(next);setError("");return true;
    } catch (e) {setError(e instanceof Error ? e.message : "Browser delete failed.");return false;}
  },[characters,loaded]);
  return { characters,save,remove,loaded,error };
}
