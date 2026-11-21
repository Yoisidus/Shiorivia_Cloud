"use client";
import { useEffect, useRef, useState } from "react";
import { useAppDialog } from "../context/DialogContext";
import { Download, Plus, Save, Trash2, Globe2, X } from "lucide-react";
import { newChartaWorld, parseChartaWorld, TIMELINE_LOCALES, type TimelineLocale, type ChartaWorld } from "../lib/chartaWorld";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import { localizeChartaError } from "../lib/chartaErrorText";
import { encodeChartaWorldExport, saveChartaJsonFile } from "../lib/chartaJson";
import type { useChartaWorlds } from "../hooks/useChartaWorlds";

export function ChartaWorldPanel({ worlds, loaded, error, saveWorld, removeWorld, embedded = false, selectedId = null, requestVersion = 0, onDirtyChange, onSaved }: ReturnType<typeof useChartaWorlds> & {
  embedded?: boolean; selectedId?: string | null; requestVersion?: number; onDirtyChange?: (dirty: boolean) => void; onSaved?: (id: string) => void;
}) {
  const dialog = useAppDialog();
  const { locale } = useLanguage();
  const [descriptionLanguage, setDescriptionLanguage] = useState<TimelineLocale>("zh-CN");
  const [draft, setDraft] = useState<ChartaWorld | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lastExternalRequest = useRef(0);
  useEffect(() => {
    if (!embedded || requestVersion === lastExternalRequest.current) return;
    lastExternalRequest.current = requestVersion;
    const entry = selectedId ? worlds.find(world => world.id === selectedId) : null;
    setDraft(entry ? { ...entry, canonTimeline: entry.canonTimeline.map(stage => ({ ...stage })) } : selectedId ? null : newChartaWorld());
    setDirty(false); setMessage("");
  }, [embedded, requestVersion, selectedId, worlds]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const edit = async (world: ChartaWorld | null) => {
    if (dirty && !await dialog.confirm(deepText(locale, "charta.discardChanges"))) return;
    setDraft(world ? { ...world, canonTimeline: world.canonTimeline.map(stage => ({ ...stage })) } : null);
    setDirty(false); setMessage("");
  };
  const update = (next: ChartaWorld) => { setDraft(next); setDirty(true); setMessage(""); };
  const save = async () => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      const world = parseChartaWorld(draft);
      if (await saveWorld(world)) { setDraft(world); setDirty(false); setMessage(deepText(locale, "charta.saved")); onSaved?.(world.id); }
      else setMessage(deepText(locale, "charta.saveError"));
    } catch (e) { setMessage(e instanceof Error ? localizeChartaError(locale, e.message) : deepText(locale, "charta.saveFailedShort")); }
    finally { setBusy(false); }
  };
  const exportWorld = () => {
    if (!draft) return;
    try {
      const parsed = parseChartaWorld(draft);
      saveChartaJsonFile(`charta-world-${parsed.id}.json`, encodeChartaWorldExport(parsed));
      setMessage(deepText(locale, "charta.exported"));
    } catch (e) { setMessage(e instanceof Error ? localizeChartaError(locale, e.message) : deepText(locale, "charta.exportError")); }
  };
  const remove = async () => {
    if (!draft || busy || !worlds.some(world => world.id === draft.id)) return;
    if (!await dialog.confirm(deepText(locale, "charta.confirmDelete"))) return;
    setBusy(true);
    try { if (await removeWorld(draft.id)) { setDraft(null); setDirty(false); setMessage(deepText(locale, "charta.deleted")); } }
    finally { setBusy(false); }
  };
  return <div className={embedded ? "min-w-0 w-full" : "mt-6 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]"}>
    {!embedded && <aside className="rounded-2xl border border-[#dce4dc] bg-white/85 p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold tracking-widest text-[#697e70]"><span>WORLD · {deepText(locale, "worldline.worldLabel")}</span><span>{worlds.length}</span></div>
      <p className="mt-2 text-xs leading-6 text-[#819588]">{deepText(locale, "charta.worldIntro")}</p>
      <button type="button" disabled={!loaded || busy} onClick={() => edit(newChartaWorld())} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#456b57] px-3 py-3 text-sm font-medium text-white disabled:opacity-40"><Plus size={16}/>{deepText(locale, "charta.newWorld")}</button>
      <div className="mt-4 space-y-2">
        {worlds.map(world => <button key={world.id} type="button" onClick={() => edit(world)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${draft?.id === world.id ? "border-[#9bbb9d] bg-[#f1f6ef]" : "border-transparent hover:bg-[#f8faf7]"}`}>
          <Globe2 size={16} className="shrink-0 text-[#6c9076]"/><span className="min-w-0 flex-1"><span className="block truncate text-sm">{world.name}</span><span className="block text-[10px] text-[#91a398]">{world.canonTimeline.length} {deepText(locale, "charta.canonStageCount")}</span></span>
        </button>)}
      </div>
      {!worlds.length && <p className="py-5 text-center text-xs text-[#9aab9e]">{deepText(locale, "charta.noCustom")}</p>}
      <p className="mt-4 text-[11px] leading-5 text-[#92a395]">{deepText(locale, "charta.builtinHint")}</p>
    </aside>}
    <section className="rounded-2xl border border-[#dce4dc] bg-white/90 p-5 shadow-sm sm:p-8">
      {!draft ? <div className="flex min-h-[440px] flex-col items-center justify-center gap-3 text-[#91a595]"><Globe2 size={42} strokeWidth={1}/><p className="text-sm">{deepText(locale, "charta.selectWorld")}</p></div> : <div className="space-y-6">
        <header className="border-b border-[#edf0e9] pb-5"><span className="text-[10px] font-semibold tracking-widest text-[#799682]">CHARTA · WORLD PROFILE</span><h2 className="mt-1 font-serif text-2xl">{draft.name || deepText(locale, "charta.untitledWorld")}</h2></header>
        <label className="block text-xs text-[#6e8472]">{deepText(locale, "charta.worldName")} *<input maxLength={100} value={draft.name} onChange={e => update({ ...draft, name: e.target.value })} placeholder={deepText(locale, "charta.worldNameExample")} className="mt-2 w-full rounded-xl border border-[#d7e0d6] bg-[#fbfcf9] px-3 py-3 text-sm"/></label>
        <section className="space-y-3 rounded-xl border border-[#dce6dc] bg-[#fcfdfa] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold text-[#53745e]">{deepText(locale, "charta.canonStages")} · ERA / PERIOD</h3><button type="button" disabled={draft.canonTimeline.length >= 80} onClick={() => update({ ...draft, canonTimeline: [...draft.canonTimeline, { era: "", period: "" }] })} className="flex items-center gap-1 rounded-lg border border-[#b6cdbb] px-3 py-1.5 text-xs text-[#557765] disabled:opacity-40"><Plus size={12}/>{deepText(locale, "charta.addStage")}</button></div>
          <p className="text-[11px] leading-6 text-[#849b8a]">{deepText(locale, "charta.stageHelp")}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#edf5ed] px-3 py-2 text-[11px] text-[#587561]"><span>{deepText(locale, "charta.stageDescriptions")}</span><label>{deepText(locale, "charta.editLanguage")} <select aria-label={deepText(locale, "charta.editLanguage")} value={descriptionLanguage} onChange={e => setDescriptionLanguage(e.target.value as TimelineLocale)} className="ml-2 rounded border border-[#cbdcce] bg-white px-2 py-1">{TIMELINE_LOCALES.map(lang => <option key={lang} value={lang}>{lang}</option>)}</select></label></div>
          {draft.canonTimeline.map((stage, i) => <div key={i} className="space-y-2 rounded-xl border border-[#e3eae0] bg-white/80 p-2"><div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <input aria-label={`ERA ${i+1}`} maxLength={100} placeholder={deepText(locale, "charta.eraExample")} value={stage.era} onChange={e=>update({...draft,canonTimeline:draft.canonTimeline.map((s,j)=>j===i?{...s,era:e.target.value}:s)})} className="min-w-0 rounded-lg border border-[#d7e0d6] px-3 py-2 text-xs"/>
            <input aria-label={`PERIOD ${i+1}`} maxLength={100} placeholder="PERIOD：T-5-6" value={stage.period} onChange={e=>update({...draft,canonTimeline:draft.canonTimeline.map((s,j)=>j===i?{...s,period:e.target.value}:s)})} className="min-w-0 rounded-lg border border-[#d7e0d6] px-3 py-2 text-xs"/>
            <button type="button" aria-label={`${deepText(locale, "charta.removeStage")} ${i+1}`} onClick={()=>update({...draft,canonTimeline:draft.canonTimeline.filter((_,j)=>j!==i)})} className="rounded-lg p-2 text-[#a98585] hover:bg-rose-50"><X size={14}/></button></div>
            <textarea rows={2} maxLength={500} aria-label={`${deepText(locale, "worldline.periodLabel")} ${i+1} · ${descriptionLanguage} · ${deepText(locale, "charta.stageDescriptions")}`} placeholder={`${descriptionLanguage} · ${deepText(locale, "charta.stageDescriptionPlaceholder")}`}
              value={stage.descriptions?.[descriptionLanguage] || ""}
              onChange={e => update({ ...draft, canonTimeline: draft.canonTimeline.map((s,j) => j === i ? { ...s, descriptions: { ...s.descriptions, [descriptionLanguage]: e.target.value } } : s) })}
              className="w-full resize-y rounded-lg border border-[#d7e0d6] bg-[#fbfcf9] p-2 text-xs leading-5"/>
            {stage.descriptions?.[locale as TimelineLocale]?.trim() && <p className="text-[10px] leading-5 text-[#819587]">{deepText(locale, "charta.currentLanguage")}{stage.descriptions[locale as TimelineLocale]}</p>}
          </div>)}
        </section>
        <label className="block text-xs text-[#6e8472]">{deepText(locale, "charta.worldDescription")}<textarea rows={9} maxLength={20000} value={draft.description} onChange={e=>update({...draft,description:e.target.value})} placeholder={deepText(locale, "charta.worldDescriptionPlaceholder")} className="mt-2 w-full resize-y rounded-xl border border-[#d7e0d6] p-3 text-sm leading-7"/></label>
        <p className="text-[11px] leading-6 text-[#809687]">{deepText(locale, "charta.worldDescriptionHelp")}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0e9] pt-5"><button type="button" disabled={busy || !worlds.some(world => world.id === draft.id)} onClick={remove} className="flex items-center gap-2 text-xs text-[#bd7777] disabled:opacity-30"><Trash2 size={14}/>{deepText(locale, "charta.deleteWorld")}</button><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={exportWorld} className="flex items-center gap-2 rounded-xl border border-[#cbdacc] px-4 py-2 text-xs text-[#456b57] disabled:opacity-40"><Download size={14}/>{deepText(locale, "charta.exportJson")}</button><button type="button" disabled={busy} onClick={save} className="flex items-center gap-2 rounded-xl bg-[#456b57] px-4 py-2 text-xs text-white disabled:opacity-40"><Save size={14}/>{deepText(locale, "charta.saveWorld")}</button></div></div>
      </div>}
      {(message || error) && <p role="status" className="mt-4 text-xs text-[#9a6e54]">{message || localizeChartaError(locale, error)}</p>}
    </section>
  </div>;
}
