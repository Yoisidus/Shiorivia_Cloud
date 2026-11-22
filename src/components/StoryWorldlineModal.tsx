"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { BookOpen, Check, Compass, Globe2, X } from "lucide-react";
import type { ChartaWorld } from "../lib/chartaWorld";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import {
  BANG_DREAM_WORLD_ID, BANG_DREAM_WORLD_NAME, describeStoryWorldline, parseStoryWorldline,
  worldlineFor, displayWorldlineEra, type StoryWorldline,
} from "../lib/storyWorldline";

export function StoryWorldlineModal({ isOpen, value, legacyTimeline, worlds, onSave, onClose, onOpenCharta }: {
  isOpen: boolean;
  value?: StoryWorldline;
  legacyTimeline?: { major?: string; medium?: string; minor?: string };
  worlds: ChartaWorld[];
  onSave: (value: StoryWorldline) => void;
  onClose: () => void;
  onOpenCharta?: () => void;
}) {
  const { locale } = useLanguage();
  const [draft, setDraft] = useState<StoryWorldline>(() => value || worldlineFor(null));
  const [error, setError] = useState("");
  useEffect(() => { if (isOpen) { setDraft(value || worldlineFor(null)); setError(""); } }, [isOpen, value]);
  const worldOptions = useMemo(() => [{ id: BANG_DREAM_WORLD_ID, name: BANG_DREAM_WORLD_NAME }, ...worlds], [worlds]);
  const canonStages = draft.canonTimeline || [];
  const eras = [...new Set(canonStages.filter(stage => !draft.period || stage.period === draft.period).map(stage => stage.era))];
  const periods = [...new Set(canonStages.filter(stage => !draft.era || stage.era === draft.era).map(stage => stage.period))];
  const baseEras = [...new Set(canonStages.map(stage => stage.era))];
  const basePeriods = canonStages.filter(stage => !draft.baseEra || stage.era === draft.baseEra);
  const chooseWorld = (id: string) => {
    const item = worlds.find(world => world.id === id) || null;
    setDraft(worldlineFor(item)); setError("");
  };
  const setEra = (era: string) => {
    setDraft(previous => ({ ...previous, era, period: !era || previous.canonTimeline.some(stage => stage.era === era && stage.period === previous.period) ? previous.period : "" }));
  };
  const setPeriod = (period: string) => {
    setDraft(previous => ({ ...previous, period, era: !period || previous.canonTimeline.some(stage => stage.era === previous.era && stage.period === period) ? previous.era : "" }));
  };
  const save = () => {
    if (draft.kind === "au" && (!draft.baseEra || !draft.basePeriod)) { setError(deepText(locale, "worldline.baseRequired")); return; }
    const valid = parseStoryWorldline(draft);
    if (!valid) { setError(deepText(locale, "worldline.invalid")); return; }
    onSave(valid); onClose();
  };
  const fieldClass = "mt-1 w-full rounded-xl border border-[#d5e3d6] bg-white px-3 py-2.5 text-sm text-[#375343] outline-none focus:border-[#739b80]";
  // Render outside the 280px sidebar so its overflow/animations cannot clip the dialog.
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>
    {isOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-[#15241c]/55 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <motion.section role="dialog" aria-modal="true" aria-label={deepText(locale, "worldline.legacyModal.heading")} initial={{ opacity: 0, y: 15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} onClick={event => event.stopPropagation()} className="flex max-h-[90vh] w-full max-w-[660px] flex-col overflow-hidden rounded-3xl border border-[#d9e7dc] bg-[#f9fbf8] text-[#304638] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#e1eae0] bg-white px-5 py-4 sm:px-7"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#e7f1e9] p-2 text-[#527a60]"><Compass size={20}/></div><div><h2 className="font-serif text-xl">{deepText(locale, "worldline.heading")} · WORLDLINE</h2><p className="mt-0.5 text-[11px] text-[#8c9e90]">{deepText(locale, "worldline.legacyModal.description")}</p></div></div><button type="button" onClick={onClose} aria-label={deepText(locale, "dialog.close")} className="rounded-lg p-2 hover:bg-[#eff3ee]"><X size={18}/></button></header>
        <div className="space-y-6 overflow-y-auto p-5 sm:p-7">
          {value && <div className="rounded-xl border border-[#d7e5da] bg-[#edf5ee] p-3 text-xs leading-6"><span className="font-semibold">{deepText(locale, "worldline.current")}：</span>{describeStoryWorldline(value, locale)}</div>}
          {!value && legacyTimeline && (legacyTimeline.major || legacyTimeline.medium || legacyTimeline.minor) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">{deepText(locale, "worldline.legacy")}{[legacyTimeline.major, legacyTimeline.medium, legacyTimeline.minor].filter(Boolean).join(" / ")}{deepText(locale, "worldline.legacyEnd")}</p>}
          <div className="space-y-2"><div className="flex items-center justify-between gap-3"><label htmlFor="story-world-select" className="flex items-center gap-2 text-xs font-semibold"><Globe2 size={14}/>{deepText(locale, "worldline.worldLabel")} *</label>{onOpenCharta && <button type="button" onClick={onOpenCharta} className="text-[11px] text-[#4d7b5e] underline">{deepText(locale, "worldline.createWorld")}</button>}</div>
            <select id="story-world-select" value={draft.worldId} onChange={e=>chooseWorld(e.target.value)} className={fieldClass}>{worldOptions.map(world=><option value={world.id} key={world.id}>{world.name}</option>)}</select>
            <p className="text-[11px] leading-5 text-[#869b8c]">{draft.worldDescription ? `${deepText(locale, "worldline.legacyModal.descriptionPrefix")}${draft.worldDescription.slice(0,160)}${draft.worldDescription.length>160 ? "…" : ""}` : deepText(locale, "worldline.noExtraLore")}</p>
          </div>
          <section className="space-y-3"><h3 className="flex items-center gap-2 text-xs font-semibold"><BookOpen size={14}/>{deepText(locale, "worldline.legacyModal.timelineType")} *</h3><div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={!canonStages.length} onClick={()=>setDraft(previous=>({...previous,kind:"canon",era:"",period:"",baseEra:undefined,basePeriod:undefined,event:previous.event}))} className={`rounded-xl border p-3 text-left text-xs ${draft.kind==="canon"?"border-[#78a182] bg-[#eaf4eb] text-[#3d6548]":"border-[#d7e3d7] bg-white text-[#76877b]"} disabled:opacity-40`}><span className="block font-semibold">{deepText(locale, "worldline.legacyModal.canon")}</span><span className="mt-1 block text-[10px] opacity-80">{deepText(locale, "worldline.legacyModal.canonHelp")}</span></button>
            <button type="button" disabled={!canonStages.length} onClick={()=>setDraft(previous=>({...previous,kind:"au",era:"",period:"",baseEra:"",basePeriod:"",event:previous.event}))} className={`rounded-xl border p-3 text-left text-xs ${draft.kind==="au"?"border-[#78a182] bg-[#eaf4eb] text-[#3d6548]":"border-[#d7e3d7] bg-white text-[#76877b]"}`}><span className="block font-semibold">{deepText(locale, "worldline.legacyModal.au")}</span><span className="mt-1 block text-[10px] opacity-80">{deepText(locale, "worldline.legacyModal.auHelp")}</span></button>
          </div>{!canonStages.length && <p className="text-[11px] text-amber-700">{deepText(locale, "worldline.noStages")}</p>}</section>
          {draft.kind === "au" && <section className="space-y-3 rounded-2xl border border-[#b8d2bf] bg-[#eff6ee] p-4">
            <h3 className="text-xs font-semibold text-[#3f7551]">{deepText(locale, "worldline.auBaseline")} *</h3>
            <p className="text-[11px] leading-5 text-[#738d79]">{deepText(locale, "worldline.auExplain")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs">{deepText(locale, "worldline.baseEra")} *<select value={draft.baseEra || ""} onChange={e=>setDraft(p=>({...p,baseEra:e.target.value,basePeriod:""}))} className={fieldClass}><option value="">{deepText(locale, "worldline.chooseBaseEra")}</option>{baseEras.map(era=><option key={era} value={era}>{displayWorldlineEra(draft.worldId, era, locale)}</option>)}</select></label>
              <label className="text-xs">{deepText(locale, "worldline.basePeriod")} *<select value={draft.basePeriod || ""} onChange={e=>setDraft(p=>({...p,basePeriod:e.target.value,baseEra:p.canonTimeline.find(stage=>stage.period===e.target.value)?.era || p.baseEra}))} className={fieldClass}><option value="">{deepText(locale, "worldline.chooseBasePeriod")}</option>{basePeriods.map(stage=><option key={stage.period} value={stage.period}>{stage.period}</option>)}</select></label>
            </div>
          </section>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">ERA · {deepText(locale, "worldline.eraLabel")} *{draft.kind==="canon" ? <select value={draft.era} onChange={e=>setEra(e.target.value)} className={fieldClass}><option value="">{deepText(locale, "worldline.chooseEra")}</option>{eras.map(era=><option key={era} value={era}>{displayWorldlineEra(draft.worldId, era, locale)}</option>)}</select> : <input maxLength={100} value={draft.era} onChange={e=>setDraft(previous=>({...previous,era:e.target.value}))} placeholder={deepText(locale, "worldline.auEraPlaceholder")} className={fieldClass}/>}</label>
            <label className="text-xs font-semibold">PERIOD · {deepText(locale, "worldline.periodLabel")} *{draft.kind==="canon" ? <select value={draft.period} onChange={e=>setPeriod(e.target.value)} className={fieldClass}><option value="">{deepText(locale, "worldline.choosePeriod")}</option>{periods.map(period=><option key={period} value={period}>{period}</option>)}</select> : <input maxLength={100} value={draft.period} onChange={e=>setDraft(previous=>({...previous,period:e.target.value}))} placeholder={deepText(locale, "worldline.auPeriodPlaceholder")} className={fieldClass}/>}</label>
          </div>
          {draft.kind === "canon" && <button type="button" onClick={() => setDraft(previous => ({ ...previous, era: "", period: "" }))} className="text-[11px] text-[#608569] underline">{deepText(locale, "worldline.resetStage")}</button>}
          <label className="block text-xs font-semibold">EVENT · {deepText(locale, "worldline.eventLabel")}<textarea rows={3} maxLength={500} value={draft.event} onChange={e=>setDraft(previous=>({...previous,event:e.target.value}))} placeholder={deepText(locale, "worldline.eventPlaceholder")} className={`${fieldClass} resize-y`}/></label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-[#e1eae0] bg-white px-5 py-4 sm:px-7"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs text-[#829186] hover:bg-[#f1f4ef]">{deepText(locale, "common.cancel")}</button><button type="button" onClick={save} className="flex items-center gap-2 rounded-xl bg-[#456b57] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#355640]"><Check size={14}/>{deepText(locale, "worldline.seal")}</button></footer>
      </motion.section>
    </motion.div>}
  </AnimatePresence>, document.body);
}
