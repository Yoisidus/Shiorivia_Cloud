"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ChevronDown, Download, FilePlus2, Palette, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { BANG_DREAM_WORLD_ID, BANG_DREAM_WORLD_NAME } from "../lib/storyWorldline";
import { useLanguage } from "../context/LanguageContext";
import { useAppDialog } from "../context/DialogContext";
import { chartaText } from "../lib/chartaText";
import { localizeChartaError } from "../lib/chartaErrorText";
import { deepText } from "../lib/i18nDeep";
import {
  CHARTA_LANGUAGES, CHARTA_PRESET_AVATARS, decodeChartaImport, encodeChartaExport,
  makeChartaId, nameForCharta, parseChartaCharacter, type ChartaCharacter,
} from "../lib/charta";
import { ChartaSelfPanel } from "./ChartaSelfPanel";
import { decodeChartaSelfImport, decodeChartaWorldImport, saveChartaJsonFile } from "../lib/chartaJson";
import { parseChartaSelf } from "../lib/chartaSelf";
import { parseChartaWorld } from "../lib/chartaWorld";
import { ChartaWorldPanel } from "./ChartaWorldPanel";
import { ChartaArchiveList } from "./ChartaArchiveList";
import type { useChartaWorlds } from "../hooks/useChartaWorlds";
import type { useChartaSelves } from "../hooks/useChartaSelves";
import { ChartaPortrait } from "./ChartaPortrait";
import { ChartaLoreEditor } from "./ChartaLoreEditor";
import { emptyChartaLore, validateChartaTimelineLinks, validateChartaRelationshipTargets } from "../lib/chartaLore";
import { BANG_DREAM_CANON } from "../lib/storyWorldline";
import { CHAR_DATA } from "../data/char_config";

type Draft = ChartaCharacter;
const newDraft = (language: string): Draft => ({ id: makeChartaId(), characterCode: "", primaryLanguage: language, names: { [language]: "" }, hex: "#799783", avatar: "", description: "", profile: emptyChartaLore(), gender: "undisclosed", createdAt: Date.now(), updatedAt: Date.now() });
const editingProfile = (draft: Draft) => draft.profile || { ...emptyChartaLore(), intro: draft.description || "" };
const colors = ["#799783", "#688ca4", "#ba8295", "#a38ebc", "#c1a276", "#4d7972", "#bd7674", "#65728d"];

export function ChartaInterface({ characters, save, remove, usedIds, onExit, loaded, storageError, selfLibrary, worldLibrary, initialSection = "characters" }: {
  characters: ChartaCharacter[];
  save: (entry: ChartaCharacter) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  usedIds: string[];
  onExit: () => void;
  loaded: boolean;
  selfLibrary: ReturnType<typeof useChartaSelves>;
  worldLibrary: ReturnType<typeof useChartaWorlds>;
  initialSection?: "characters" | "self" | "worlds";
  storageError: string;
}) {
  const { locale } = useLanguage();
  const dialog = useAppDialog();
  type CabinetKind = "characters" | "self" | "worlds";
  const [section, setSection] = useState<CabinetKind>(initialSection);
  const [cabinetHome, setCabinetHome] = useState(true);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importKindRef = useRef<CabinetKind>("characters");
  const [cabinetSelection, setCabinetSelection] = useState<{ kind: "characters" | "self" | "worlds"; id: string | null }>({ kind: initialSection, id: null });
  const [requestVersion, setRequestVersion] = useState(0);
  const [childDirty, setChildDirty] = useState(false);
  const onChildDirty = useCallback((value: boolean) => setChildDirty(value), []);
  const txt = (key: Parameters<typeof chartaText>[1]) => chartaText(locale, key);
  const cabinetText = (key: string) => deepText(locale, `charta.cabinet.${key}`);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [extraLang, setExtraLang] = useState("en");
  const [primaryOther, setPrimaryOther] = useState(false);
  const [primaryLangInput, setPrimaryLangInput] = useState("");
  const [customLang, setCustomLang] = useState("");
  const [message, setMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const update = (next: Draft) => { setDraft(next); setDirty(true); setMessage(""); };
  const select = async (next: Draft | null) => {
    if (dirty && !await dialog.confirm(txt("unsaved"))) return;
    setDraft(next); setDirty(false); setShowAdd(false); setMessage("");
  };
  const start = () => select(newDraft(locale));
  const codeUsedBy = (code: string, exceptId?: string) =>
    [...CHAR_DATA, ...characters].find(c =>
      c.id !== exceptId &&
      ((("characterCode" in c ? String(c.characterCode || c.id) : c.id).toLowerCase() === code.trim().toLowerCase())
        || c.id.toLowerCase() === code.trim().toLowerCase()));
  const saveDraft = async () => {
    if (busy || !draft) return;
    if (!draft.characterCode?.trim() || !/^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(draft.characterCode.trim())) {
      setMessage(cabinetText("invalidCharacterId")); return;
    }
    if (codeUsedBy(draft.characterCode, draft.id)) {
      setMessage(cabinetText("duplicateCharacterId")); return;
    }
    if (!draft.names[draft.primaryLanguage]?.trim() || !draft.hex || !draft.avatar) { setMessage(txt("required")); return; }
    if (draft.worldId && draft.worldId !== BANG_DREAM_WORLD_ID && !worldLibrary.worlds.some(world => world.id === draft.worldId)) {
      setMessage(cabinetText("missingWorld")); return;
    }
    const selectedStages = draft.worldId === BANG_DREAM_WORLD_ID ? BANG_DREAM_CANON : worldLibrary.worlds.find(world=>world.id===draft.worldId)?.canonTimeline || [];
    const warning = validateChartaTimelineLinks(editingProfile(draft), selectedStages);
    if (warning) { setMessage(localizeChartaError(locale, warning)); return; }
    const targetError = validateChartaRelationshipTargets(editingProfile(draft), draft.worldId, [...characters, ...selfLibrary.selves]);
    if (targetError) { setMessage(localizeChartaError(locale, targetError)); return; }
    setBusy(true);
    try {
      const data = parseChartaCharacter(draft);
      if (await save(data)) { setDraft(data); setDirty(false); setMessage(txt("saved")); setCabinetSelection({ kind: "characters", id: data.id }); }
    } catch (e) { setMessage(e instanceof Error ? localizeChartaError(locale, e.message) : txt("required")); }
    finally { setBusy(false); }
  };
  const exportDraft = () => {
    if (!draft) return;
    try {
      const data = parseChartaCharacter(draft);
      saveChartaJsonFile(`charta-${data.id}.json`, encodeChartaExport(data));
    } catch (e) { setMessage(e instanceof Error ? localizeChartaError(locale, e.message) : txt("required")); }
  };
  const openImport = (kind: CabinetKind) => {
    importKindRef.current = kind;
    setImportMenuOpen(false);
    importRef.current?.click();
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    const kind = importKindRef.current;
    try {
      if (file.size > 1024 * 1024) throw new Error(cabinetText("fileTooLarge"));
      const source: unknown = JSON.parse(await file.text());
      const now = Date.now();
      if (kind === "characters") {
        const original = decodeChartaImport(source);
        const imported = parseChartaCharacter({
          ...original, id: makeChartaId(), portrait: undefined,
          createdAt: now, updatedAt: now,
        });
        if (imported.worldId && imported.worldId !== BANG_DREAM_WORLD_ID
          && !worldLibrary.worlds.some(w => w.id === imported.worldId)) {
          throw new Error(cabinetText("importWorldMissing"));
        }
        const stages = imported.worldId === BANG_DREAM_WORLD_ID ? BANG_DREAM_CANON
          : worldLibrary.worlds.find(w => w.id === imported.worldId)?.canonTimeline || [];
        const validation = imported.profile && (validateChartaTimelineLinks(imported.profile, stages)
          || validateChartaRelationshipTargets(imported.profile, imported.worldId, [...characters, ...selfLibrary.selves]));
        if (validation) throw new Error(localizeChartaError(locale, validation) + cabinetText("importDependencySuffix"));
        if (!await save(imported)) throw new Error(cabinetText("characterSaveFailed"));
        setSection("characters");
        setCabinetSelection({kind:"characters",id:imported.id});
        setDraft(imported); setDirty(false); setCabinetHome(false);
      } else if (kind === "self") {
        const original = decodeChartaSelfImport(source);
        const imported = parseChartaSelf({
          ...original, id: selfLibrary.selves.some(item=>item.id===original.id)
            ? `self-${crypto.randomUUID()}` : original.id,
          createdAt: now, updatedAt: now,
        });
        if (imported.worldId && imported.worldId !== BANG_DREAM_WORLD_ID
          && !worldLibrary.worlds.some(w => w.id === imported.worldId)) {
          throw new Error(cabinetText("importWorldMissing"));
        }
        const stages = imported.worldId === BANG_DREAM_WORLD_ID ? BANG_DREAM_CANON
          : worldLibrary.worlds.find(w => w.id === imported.worldId)?.canonTimeline || [];
        const validation = imported.profile && (validateChartaTimelineLinks(imported.profile, stages)
          || validateChartaRelationshipTargets(imported.profile, imported.worldId, [...characters, ...selfLibrary.selves]));
        if (validation) throw new Error(localizeChartaError(locale, validation) + cabinetText("importDependencySuffix"));
        if (!await selfLibrary.saveSelf(imported)) throw new Error(cabinetText("selfSaveFailed"));
        setSection("self");
        setCabinetSelection({kind:"self",id:imported.id});
        setRequestVersion(version => version + 1);
        setChildDirty(false); setCabinetHome(false);
      } else {
        const original = decodeChartaWorldImport(source);
        const imported = parseChartaWorld({
          ...original, id: worldLibrary.worlds.some(item=>item.id===original.id)
            ? `world-${crypto.randomUUID()}` : original.id,
          createdAt: now, updatedAt: now,
        });
        if (!await worldLibrary.saveWorld(imported)) throw new Error(cabinetText("worldSaveFailed"));
        setSection("worlds");
        setCabinetSelection({kind:"worlds",id:imported.id});
        setRequestVersion(version => version + 1);
        setChildDirty(false); setCabinetHome(false);
      }
      setMessage(cabinetText("importSuccess"));
    } catch (e) {
      setMessage(e instanceof SyntaxError ? cabinetText("importFailed") : e instanceof Error ? localizeChartaError(locale, e.message) : cabinetText("importFailed"));
    } finally { setBusy(false); }
  };
  const deleteDraft = async () => {
    if (!draft || busy || !characters.some(c => c.id === draft.id)) return;
    if (usedIds.includes(draft.id)) { setMessage(txt("inUse")); return; }
    if (await dialog.confirm(txt("confirmDelete"))) {
      setBusy(true);
      try { if (await remove(draft.id)) { setDraft(null); setDirty(false); setMessage(txt("deleted")); } }
      finally { setBusy(false); }
    }
  };
  const addLanguage = () => {
    if (!draft) return;
    const lang = extraLang === "other" ? customLang.trim().toLowerCase() : extraLang;
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}$/.test(lang) || lang in draft.names || Object.keys(draft.names).length >= 12) { setMessage(txt("noOther")); return; }
    update({ ...draft, names: { ...draft.names, [lang]: "" } }); setShowAdd(false); setCustomLang("");
  };
  const chooseArchive = async (kind: "characters" | "self" | "worlds", id: string | null) => {
    if ((dirty || childDirty) && !await dialog.confirm(cabinetText("unsavedSwitch"))) return;
    setSection(kind); setCabinetSelection({ kind, id }); setChildDirty(false); setCabinetHome(false); setImportMenuOpen(false);
    if (kind === "characters") {
      const item = id ? characters.find(character => character.id === id) : null;
      setDraft(item ? { ...item, names: { ...item.names }, profile: item.profile ? { ...item.profile, relationships: item.profile.relationships.map(r=>({...r,periods:[...r.periods]})), experiences:item.profile.experiences.map(e=>({...e,periods:[...e.periods]})) } : { ...emptyChartaLore(), intro:item.description || "" } } : newDraft(locale));
      setDirty(false);
    } else {
      setRequestVersion(version => version + 1);
      setDirty(false);
    }
  };
  const closeArchive = async () => {
    if (!cabinetHome) {
      if ((dirty || childDirty) && !await dialog.confirm(cabinetText("unsavedReturn"))) return;
      setCabinetHome(true);
      setDraft(null); setDirty(false); setChildDirty(false); setMessage("");
      setCabinetSelection({ kind: section, id: null });
      setImportMenuOpen(false);
      return;
    }
    onExit();
  };
  // Unified archive cabinet renders the three editors in one detail pane.
  return <main className="min-h-screen bg-[#f7f8f5] text-[#2c443a]" style={{ backgroundImage: "radial-gradient(ellipse at top right, #e8ede7, transparent 60%)" }}>
    <input ref={importRef} type="file" className="hidden" accept=".json,application/json" onChange={importFile} />
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce5dc] pb-5">
        <button type="button" onClick={closeArchive} className="flex items-center gap-2 rounded-xl border border-[#d7e1d8] bg-white px-3 py-2 text-xs hover:border-[#7a9b83]"><ArrowLeft size={16}/>{cabinetHome ? cabinetText("backToHub") : cabinetText("backToCabinet")}</button>
        <div className="text-center"><h1 className="font-serif text-3xl tracking-[0.16em]">CHARTA · {cabinetText("title")}</h1><p className="pt-1 text-[11px] tracking-[0.22em] text-[#7c9181]">CHARACTER · SELF · WORLD</p></div>
        <div className="relative">
          {cabinetHome ? <>
            <button type="button" onClick={()=>setImportMenuOpen(open=>!open)} aria-expanded={importMenuOpen} aria-controls="charta-import-menu" className="flex items-center gap-2 rounded-xl border border-[#d7e1d8] bg-white px-3 py-2 text-xs hover:border-[#7a9b83]"><Upload size={15}/>{cabinetText("importJson")}<ChevronDown size={14}/></button>
            {importMenuOpen && <div id="charta-import-menu" className="absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-xl border border-[#d7e1d8] bg-white p-1 shadow-lg">
              {([{kind:"characters" as const,label:cabinetText("importCharacter")},{kind:"self" as const,label:cabinetText("importSelf")},{kind:"worlds" as const,label:cabinetText("importWorld")}]).map(option=>
                <button type="button" key={option.kind} onClick={()=>openImport(option.kind)} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f0f5ef]">{option.label}</button>)}
            </div>}
          </> : <span className="text-xs text-[#7b8e80]">CHARTA EDITOR</span>}
        </div>
      </header>
      {cabinetHome && (
        <section aria-label={cabinetText("tipsAria")} className="mx-auto mt-6 max-w-3xl rounded-2xl border border-[#dce7dd] bg-[#f0f6ef] px-4 py-4 sm:px-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#446c53]"><FilePlus2 size={17} />{cabinetText("tipTitle")}</h2>
          <p className="mt-2 text-xs leading-6 text-[#607d69]"> {cabinetText("tipCreateBefore")}<strong className="mx-1 text-[#436b50]">{cabinetText("tipCreateHighlight")}</strong>{cabinetText("tipCreateAfter")}</p>
          <p className="mt-1 text-xs leading-6 text-[#607d69]"> {cabinetText("tipImportBefore")}<strong className="mx-1 text-[#436b50]">{cabinetText("tipImportHighlight")}</strong>{cabinetText("tipImportAfter")}</p>
          <p className="mt-2 text-[11px] text-[#879b88]">{cabinetText("tipFlexible")}</p>
        </section>
      )}
      <div className={cabinetHome ? "mt-6 mx-auto max-w-3xl" : "mt-6 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]"}>
        <ChartaArchiveList characters={characters} selves={selfLibrary.selves} worlds={worldLibrary.worlds}
          activeSelfId={selfLibrary.activeId} selection={cabinetSelection} locale={locale}
          onChoose={(kind, id) => chooseArchive(kind, id)} onCreate={(kind) => chooseArchive(kind, null)}
          onActivate={(id) => { void selfLibrary.selectSelf(id); }} />
        {!cabinetHome && (section === "self"
          ? <ChartaSelfPanel {...selfLibrary} characters={characters} worlds={worldLibrary.worlds} embedded selectedId={cabinetSelection.id} requestVersion={requestVersion} onDirtyChange={onChildDirty} onSaved={(id) => setCabinetSelection({ kind: "self", id })} />
          : section === "worlds"
            ? <ChartaWorldPanel {...worldLibrary} embedded selectedId={cabinetSelection.id} requestVersion={requestVersion} onDirtyChange={onChildDirty} onSaved={(id) => setCabinetSelection({ kind: "worlds", id })} />
            : <section className="rounded-2xl border border-[#dce4dc] bg-white/90 p-5 shadow-sm sm:p-8">
          {!draft ? <div className="flex min-h-[500px] flex-col items-center justify-center gap-4 text-[#90a393]"><FilePlus2 size={44} strokeWidth={1}/><p className="text-sm">{txt("choose")}</p></div> : <div className="space-y-8">
            <div className="flex items-center gap-4 border-b border-[#edf0e9] pb-6"><ChartaPortrait character={{avatar:draft.avatar || "📜",hex:draft.hex}} className="h-20 w-20 rounded-2xl"/><div className="min-w-0"><span className="text-[10px] font-semibold tracking-widest text-[#819687]">CHARTA · CHARACTER PROFILE</span><h2 className="truncate pt-1 font-serif text-2xl">{draft.names[draft.primaryLanguage] || txt("new")}</h2><p className="text-xs text-[#97a99a]">{txt("identity")}</p></div></div>
            <div className="space-y-4"><h3 className="text-xs font-bold tracking-widest uppercase text-[#547562]">01 · {txt("identity")}</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_190px_auto] sm:items-end"><label className="block text-xs text-[#6e8472]">{txt("primary")} *<input value={draft.names[draft.primaryLanguage] || ""} maxLength={100} onChange={e => update({ ...draft, names: { ...draft.names, [draft.primaryLanguage]: e.target.value } })} className="mt-2 w-full rounded-xl border border-[#d7e0d6] bg-[#fbfcf9] px-3 py-3 text-sm outline-none focus:border-[#7e9f86]" /></label>
                <label className="block text-xs text-[#6e8472]">{txt("language")} *<select value={CHARTA_LANGUAGES.some(o=>o.code===draft.primaryLanguage) ? draft.primaryLanguage : "other"} onChange={e => {const lang = e.target.value; if(lang!=="other") {setPrimaryOther(false);update({...draft, primaryLanguage:lang,names:{...draft.names,[lang]:draft.names[lang]||""}});} else setPrimaryOther(true);}} className="mt-2 w-full rounded-xl border border-[#d7e0d6] bg-[#fbfcf9] px-3 py-3 text-sm outline-none">{CHARTA_LANGUAGES.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></label>
                <button type="button" onClick={() => setShowAdd(!showAdd)} title={txt("addName")} aria-label={txt("addName")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d7e0d6] text-[#5b8168] hover:bg-[#eaf1e9]"><Plus size={18}/></button>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-[#6e8472]">{cabinetText("characterIdLabel")}
                  <input value={draft.characterCode || ""} maxLength={64}
                    onChange={e => update({ ...draft, characterCode: e.target.value.trim() })}
                    placeholder={cabinetText("characterIdPlaceholder")}
                    className="mt-2 w-full rounded-xl border border-[#d7e0d6] bg-[#fbfcf9] px-3 py-3 font-mono text-sm outline-none focus:border-[#7e9f86]" />
                </label>
                {draft.characterCode?.trim() && <p role="status" className={`text-[11px] ${/^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(draft.characterCode)
                  && !codeUsedBy(draft.characterCode, draft.id) ? "text-emerald-700" : "text-rose-600"}`}>
                  {/^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(draft.characterCode)
                    ? (codeUsedBy(draft.characterCode, draft.id) ? cabinetText("characterIdTaken") : cabinetText("characterIdAvailable"))
                    : cabinetText("characterIdFormat")}
                </p>}
              </div>
              {primaryOther && <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[#dce4dc] bg-[#f7f9f5] p-3"><label className="min-w-[160px] flex-1 text-xs">{txt("otherLanguage")}<input value={primaryLangInput} onChange={e=>setPrimaryLangInput(e.target.value)} placeholder="fr / de / es" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"/></label><button type="button" className="rounded-lg bg-[#456b57] px-3 py-2 text-xs text-white" onClick={()=>{const lang=primaryLangInput.trim();if(!/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8}){0,3}$/.test(lang)){setMessage(txt("required"));return;}update({...draft,primaryLanguage:lang,names:{...draft.names,[lang]:draft.names[lang]||""}});setPrimaryOther(false);}}>{txt("language")}</button></div>}
              {showAdd && <div className="grid items-end gap-2 rounded-xl border border-[#e1e8dc] bg-[#f7f9f5] p-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs">{txt("language")}<select value={extraLang} onChange={e=>setExtraLang(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm">{CHARTA_LANGUAGES.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></label>{extraLang==="other"?<input value={customLang} onChange={e=>setCustomLang(e.target.value)} placeholder={txt("otherLanguage")} className="rounded-lg border p-2 text-sm"/>:<span/>}<button type="button" onClick={addLanguage} className="rounded-lg bg-[#65876d] p-2 text-xs text-white">{txt("addName")}</button></div>}
              {Object.keys(draft.names).filter(lang=>lang!==draft.primaryLanguage).map(lang=><div key={lang} className="flex items-center gap-2"><span className="w-14 shrink-0 text-xs text-[#809587]">{lang}</span><input value={draft.names[lang]||""} onChange={e=>update({...draft,names:{...draft.names,[lang]:e.target.value}})} placeholder={txt("extraName")} maxLength={100} className="w-full rounded-xl border border-[#d7e0d6] px-3 py-2 text-sm outline-none focus:border-[#7e9f86]"/><button type="button" title={cabinetText("removeOtherName")} onClick={()=>{const next={...draft.names};delete next[lang];update({...draft,names:next});}}><X size={16}/></button></div>)}
              <div className="space-y-2"><label className="block text-xs text-[#6e8472]">{deepText(locale, "charta.self.gender")}</label><div className="flex flex-wrap gap-2">{([ ["male","charta.self.male"], ["female","charta.self.female"], ["undisclosed","charta.self.undisclosed"], ["custom","charta.self.custom"] ] as const).map(([value,labelKey])=><button key={value} type="button" aria-pressed={(draft.gender||"undisclosed")===value} onClick={()=>update({...draft,gender:value})} className={`rounded-xl border px-3 py-2 text-xs ${(draft.gender||"undisclosed")===value ? "border-[#60856a] bg-[#edf5ec] text-[#345443]" : "border-[#d8e4d8] text-[#819588]"}`}>{deepText(locale, labelKey)}</button>)}</div>{draft.gender==="custom"&&<input maxLength={100} value={draft.genderCustom||""} onChange={e=>update({...draft,genderCustom:e.target.value})} placeholder={deepText(locale, "charta.self.customGenderHint")} className="w-full rounded-xl border border-[#d7e0d6] px-3 py-2 text-sm"/>}</div>
              <section className="space-y-4 rounded-2xl border border-[#e0e9df] bg-[#fbfdfa] p-4">
                <h4 className="text-xs font-semibold tracking-wider text-[#51745e]">{cabinetText("profileExtrasTitle")}</h4>
                <p className="text-[11px] text-[#91a393]">{cabinetText("profileExtrasHint")}</p>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-[#688270]">{deepText(locale, "charta.self.alias")}</span><button type="button" disabled={(draft.aliases||[]).length>=50} onClick={()=>update({...draft,aliases:[...(draft.aliases||[]),""]})} className="flex items-center gap-1 text-xs text-[#568466] disabled:opacity-40"><Plus size={14}/>{deepText(locale, "charta.self.addAlias")}</button></div>
                  {(draft.aliases||[]).map((alias,i)=><div key={i} className="flex gap-2"><input value={alias} onChange={e=>update({...draft,aliases:(draft.aliases||[]).map((x,j)=>j===i?e.target.value:x)})} maxLength={100} placeholder={deepText(locale, "charta.self.aliasExample")} className="min-w-0 flex-1 rounded-xl border border-[#d7e0d6] px-3 py-2 text-sm"/><button type="button" aria-label={deepText(locale, "charta.self.removeAlias")} onClick={()=>update({...draft,aliases:(draft.aliases||[]).filter((_,j)=>j!==i)})} className="text-[#b0837d]"><X size={15}/></button></div>)}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([{key:"hairColor",label:deepText(locale,"charta.self.hair"),placeholder:cabinetText("hairExample")},{key:"eyeColor",label:deepText(locale,"charta.self.eyes"),placeholder:cabinetText("eyesExample")},{key:"height",label:deepText(locale,"charta.self.height"),placeholder:cabinetText("heightExample")},{key:"birthday",label:deepText(locale,"charta.self.birthday"),placeholder:cabinetText("birthdayExample")},{key:"zodiac",label:deepText(locale,"charta.self.zodiac"),placeholder:cabinetText("zodiacExample")}] as const).map(({key,label,placeholder})=><label key={key} className="text-xs text-[#6e8472]">{label}<input value={draft[key]||""} onChange={e=>update({...draft,[key]:e.target.value})} maxLength={100} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-[#d7e0d6] px-3 py-2 text-sm"/></label>)}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-[#688270]">{deepText(locale, "charta.self.moe")}</span><button type="button" disabled={(draft.moeTags||[]).length>=50} onClick={()=>update({...draft,moeTags:[...(draft.moeTags||[]),""]})} className="flex items-center gap-1 text-xs text-[#568466] disabled:opacity-40"><Plus size={14}/>{deepText(locale, "charta.self.addMoe")}</button></div>
                  {(draft.moeTags||[]).map((tag,i)=><div key={i} className="flex gap-2"><input value={tag} onChange={e=>update({...draft,moeTags:(draft.moeTags||[]).map((x,j)=>j===i?e.target.value:x)})} maxLength={100} placeholder={deepText(locale, "charta.self.moeExample")} className="min-w-0 flex-1 rounded-xl border border-[#d7e0d6] px-3 py-2 text-sm"/><button type="button" aria-label={deepText(locale, "charta.self.removeMoe")} onClick={()=>update({...draft,moeTags:(draft.moeTags||[]).filter((_,j)=>j!==i)})} className="text-[#b0837d]"><X size={15}/></button></div>)}
                </div>
              </section>
              <p className="text-[11px] leading-6 text-[#8ba08f]">{txt("nameHint")}</p>
              <label className="block text-xs text-[#6e8472]">{deepText(locale, "charta.self.world")} · WORLD
                <select value={draft.worldId || ""} onChange={e => update({ ...draft, worldId: e.target.value || undefined })}
                  className="mt-2 w-full rounded-xl border border-[#d7e0d6] bg-[#fbfcf9] px-3 py-3 text-sm outline-none focus:border-[#7e9f86]">
                  <option value="">{cabinetText("characterNoWorld")}</option>
                  <option value={BANG_DREAM_WORLD_ID}>{BANG_DREAM_WORLD_NAME}{deepText(locale, "charta.self.builtIn")}</option>
                  {worldLibrary.worlds.map(world => <option key={world.id} value={world.id}>{world.name}</option>)}
                  {draft.worldId && draft.worldId !== BANG_DREAM_WORLD_ID && !worldLibrary.worlds.some(world => world.id === draft.worldId) &&
                    <option value={draft.worldId}>{deepText(locale, "charta.self.worldDeleted")}</option>}
                </select>
              </label>
              <p className="text-[11px] leading-5 text-[#8ba08f]">{cabinetText("characterWorldHelp")}</p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xs font-bold tracking-widest uppercase text-[#547562]">02 · {txt("appearance")}</h3>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.88fr)] lg:items-stretch">
                <section aria-label={txt("appearance")} className="min-w-0 rounded-2xl border border-[#dce6dc] bg-[#fcfdfa] p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-5"><ChartaPortrait character={{avatar:draft.avatar||"📜",hex:draft.hex}} className="h-28 w-28 rounded-2xl border border-[#d4dfd5]"/>
                <div className="min-w-0 flex-1 space-y-2"><p className="text-xs text-[#6e8472]">{txt("preset")} *</p><div className="flex flex-wrap gap-2">{CHARTA_PRESET_AVATARS.map(a=><button type="button" key={a} onClick={()=>update({...draft,avatar:a})} aria-label={a} aria-pressed={draft.avatar===a} className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${draft.avatar===a?"border-[#4b7b5b] bg-[#edf5ec]":"border-[#dce5da] hover:bg-[#f6faf5]"}`}>{a}</button>)}</div><p className="text-[10px] text-[#94a596]">{deepText(locale, "cloud.charta.imageLocalOnly")}</p></div>
              </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#e7eee6] pt-5">
                    <label className="text-xs text-[#728976]">{txt("color")} *<input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.hex)?draft.hex:"#799783"} onChange={e=>update({...draft,hex:e.target.value})} className="ml-3 h-9 w-12 cursor-pointer align-middle" /></label>
                    <label className="text-xs text-[#728976]">HEX<input value={draft.hex} onChange={e=>update({...draft,hex:e.target.value})} maxLength={7} className="ml-2 w-24 rounded-lg border px-2 py-2 font-mono text-xs"/></label>
                    <Palette size={18} className="text-[#8da596]" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2" aria-label={txt("palette")}>{colors.map(c=><button type="button" key={c} onClick={()=>update({...draft,hex:c})} aria-label={c} title={c} aria-pressed={draft.hex===c} className={`h-8 w-8 rounded-full border-2 ${draft.hex===c?"border-[#243b33]":"border-white"}`} style={{backgroundColor:c}}/>)}</div>
                </section>
                <section className="min-w-0 rounded-2xl border border-[#dce6dc] bg-[#fcfdfa] p-4 sm:p-5">
                  <h4 className="font-serif text-lg text-[#365443]">{txt("standeeTitle")}</h4>
                  <p className="mt-3 text-xs leading-6 text-[#829888]">{deepText(locale, "cloud.charta.imageLocalOnly")}</p>
                </section>
              </div>
            </div>
            <ChartaLoreEditor
                value={editingProfile(draft)}
                onChange={profile=>update({...draft,profile})}
                stages={draft.worldId === BANG_DREAM_WORLD_ID ? BANG_DREAM_CANON : worldLibrary.worlds.find(world=>world.id===draft.worldId)?.canonTimeline || []}
                currentId={draft.id} characters={characters} worldId={draft.worldId} selves={selfLibrary.selves}
              />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0e9] pt-5"><button type="button" disabled={!characters.some(c=>c.id===draft.id)} onClick={deleteDraft} className="inline-flex items-center gap-2 rounded-xl border border-rose-100 px-3 py-3 text-xs text-rose-600 disabled:opacity-30"><Trash2 size={15}/>{txt("delete")}</button><div className="flex flex-wrap gap-2"><button type="button" onClick={exportDraft} className="inline-flex items-center gap-2 rounded-xl border border-[#cbdacc] px-4 py-3 text-xs"><Download size={15}/>{txt("export")}</button><button type="button" disabled={busy} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl bg-[#456b57] px-4 py-3 text-xs font-semibold text-white hover:bg-[#355640] disabled:opacity-50"><Save size={15}/>{txt("save")}</button></div></div>
          </div>}
          {(message || storageError) && <p role="status" className="mt-4 rounded-lg bg-[#f2f4ee] px-4 py-3 text-xs text-[#607566]">{storageError ? localizeChartaError(locale, storageError) : message}</p>}
          <p className="mt-5 text-[11px] leading-6 text-[#9cab9c]">{txt("independent")}</p>
        </section>)}
      </div>
      {message && <p role="status" className="mx-auto mt-4 max-w-3xl rounded-xl bg-[#f0f5ef] px-4 py-3 text-xs text-[#54705f]">{message}</p>}
    </div>
  </main>;
}
