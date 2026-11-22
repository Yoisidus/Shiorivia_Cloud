"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, CircleDot, Compass, Globe2, Orbit, RotateCcw, Sparkles, X, Plus, Trash2 } from "lucide-react";
import type { ChartaWorld } from "../lib/chartaWorld";
import { canExtendWorldline } from "../lib/worldlineLock";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import {
  BANG_DREAM_WORLD_ID, BANG_DREAM_WORLD_NAME, describeStoryWorldline,
  parseStoryWorldline, worldlineFor, timelineStageDescription, worldlineStageIndex, displayWorldlineEra, type StoryWorldline,
} from "../lib/storyWorldline";

const geometric = { fontFamily: 'Bahnschrift, "DIN Alternate", "Arial Narrow", "Yu Gothic", "Noto Sans SC", sans-serif' };


export function StoryWorldlineFateModal({ isOpen, value, legacyTimeline, worlds, onSave, onClose, onOpenCharta, elevated = false, showEvent = true, tone = "story" }: {
  isOpen: boolean;
  value?: StoryWorldline;
  legacyTimeline?: { major?: string; medium?: string; minor?: string };
  worlds: ChartaWorld[];
  onSave: (worldline: StoryWorldline) => void;
  onClose: () => void;
  onOpenCharta?: () => void;
  elevated?: boolean;
  showEvent?: boolean;
  tone?: "story" | "novel" | "chat";
}) {
  const { locale } = useLanguage();
  const [timeUnlocked, setTimeUnlocked] = useState(false);
  const novel = tone === "novel";
  const chat = tone === "chat";
  const inputStyle = "mt-2 w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none transition focus:ring-2 "
    + (novel ? "border-[#dac4a3] bg-[#fffcf6] text-[#614733] focus:border-[#b99264] focus:ring-[#d9b483]/25"
        : chat ? "border-[#b7dcc6] bg-[#f9fff9] text-[#2e654b] focus:border-[#6ba889] focus:ring-[#85bfa2]/25"
        : "border-[#e7b7ca] bg-[#fffafd] text-[#682c49] focus:border-[#c15f86] focus:ring-[#d989aa]/25");
  const [draft, setDraft] = useState<StoryWorldline>(() => value || worldlineFor(null));
  const [error, setError] = useState("");
  useEffect(() => {
    if (isOpen) { setDraft(value || worldlineFor(null)); setError(""); setTimeUnlocked(false); }
  }, [isOpen, value]);
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const primaryLocked = Boolean(value && parseStoryWorldline(value));
  const timeEditable = !primaryLocked || timeUnlocked;
  const minStageIndex = value?.kind === "canon" ? worldlineStageIndex(value) : -1;
  const previousSecondary = new Set(value?.crossWorld?.secondary.map(w => w.worldId) || []);
  const choices = useMemo(() => {
    const list = [{ id: BANG_DREAM_WORLD_ID, name: BANG_DREAM_WORLD_NAME }, ...worlds];
    if (value && !list.some(world => world.id === value.worldId)) list.push({ id: value.worldId, name: value.worldName });
    return list;
  }, [worlds, value]);
  const stages = draft.canonTimeline || [];
  const currentStage = stages.find(stage => stage.era === draft.era && stage.period === draft.period);
  const eras = [...new Set(stages.filter((s, index) => (minStageIndex < 0 || index >= minStageIndex)).map(s => s.era))];
  const periods = [...new Set(stages.filter((s, index) => (minStageIndex < 0 || index >= minStageIndex) && (!draft.era || s.era === draft.era)).map(s => s.period))];
  const baseEras = [...new Set(stages.map(s => s.era))];
  const basePeriods = stages.filter(s => !draft.baseEra || s.era === draft.baseEra);
  const chooseWorld = (id: string) => {
    if (primaryLocked) return;
    const world = worlds.find(item => item.id === id) || null;
    if (id === draft.worldId) return;
    setDraft(worldlineFor(world)); setError("");
  };
  const crossWorld = draft.crossWorld || { enabled: false, includeUniversal: false, secondary: [] };
  const addSecondary = () => {
    if (!crossWorld.enabled || crossWorld.secondary.length >= 3) return;
    const available = choices.find(item => item.id !== draft.worldId &&
      !crossWorld.secondary.some(secondary => secondary.worldId === item.id));
    if (!available) { setError(deepText(locale, "worldline.noOtherWorld")); return; }
    const custom = worlds.find(item => item.id === available.id);
    const newWorld = { worldId: available.id, worldName: available.name,
      worldDescription: custom?.description || "",
      canonTimeline: available.id === BANG_DREAM_WORLD_ID ? (worldlineFor(null).canonTimeline) : (custom?.canonTimeline || []),
      baseEra: "", basePeriod: "" };
    setDraft(prev => ({ ...prev, crossWorld: { ...crossWorld,
      secondary: [...crossWorld.secondary, newWorld] } }));
  };
  const changeSecondary = (index: number, worldId: string) => {
    if (previousSecondary.has(crossWorld.secondary[index]?.worldId)) return;
    const world = worlds.find(item => item.id === worldId);
    const next = { worldId, worldName: world?.name || BANG_DREAM_WORLD_NAME,
      worldDescription: world?.description || "",
      canonTimeline: worldId === BANG_DREAM_WORLD_ID ? worldlineFor(null).canonTimeline : world?.canonTimeline || [],
      baseEra: "", basePeriod: "" };
    setDraft(prev => ({ ...prev, crossWorld: { ...crossWorld,
      secondary: crossWorld.secondary.map((item, i) => i === index ? next : item) } }));
  };
  const changeSecondaryBaseline = (index: number, era: string, period: string) => {
    if (previousSecondary.has(crossWorld.secondary[index]?.worldId)) return;
    setDraft(prev => ({ ...prev, crossWorld: { ...crossWorld, secondary: crossWorld.secondary.map((item, i) =>
      i === index ? { ...item, baseEra: era, basePeriod: period } : item) } }));
  };
  const chooseEra = (era: string) => { if (!timeEditable) return; setDraft(prev => ({ ...prev, era,
    period: !era || prev.canonTimeline.some(stage => stage.era === era && stage.period === prev.period) ? prev.period : "" })); };
  const choosePeriod = (period: string) => { if (!timeEditable) return; setDraft(prev => ({ ...prev, period,
    era: !period || prev.canonTimeline.some(stage => stage.era === prev.era && stage.period === period) ? prev.era : "" })); };
  const save = () => {
    if (draft.kind === "au" && (!draft.baseEra || !draft.basePeriod)) { setError(deepText(locale, "worldline.baseRequired")); return; }
    const next = parseStoryWorldline(showEvent ? draft : { ...draft, event: "" });
    if (!next) { setError(deepText(locale, "worldline.invalid")); return; }
    if (!canExtendWorldline(value, next)) { setError(deepText(locale, "worldline.forbidden")); return; }
    onSave(next); onClose();
  };

  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>
    {isOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className={`fixed inset-0 ${elevated ? "z-[800]" : "z-[110]"} flex items-center justify-center overflow-y-auto bg-[#101d1d]/75 p-3 backdrop-blur-[8px] sm:p-6`}
      onClick={onClose}>
      <motion.section role="dialog" aria-modal="true" aria-label={deepText(locale, "worldline.heading")}
        initial={{ opacity: 0, scale: .96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: .97, y: 12 }} onClick={e => e.stopPropagation()}
        className={`relative flex max-h-[94dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] border shadow-[0_35px_100px_rgba(4,18,18,.35)] ${novel ? "border-[#d7b889] bg-[#fff9ee] text-[#674a31]" : chat ? "border-[#b2d6bd] bg-[#f5fcf6] text-[#2e5e45]" : "border-[#e4a9c0] bg-[#fff6fa] text-[#6a2946]"}`}>
        <header className={`relative isolate shrink-0 overflow-hidden px-5 pb-7 pt-7 sm:px-8 sm:pt-9 ${novel ? "bg-[#62432f] text-[#fff1d9]" : chat ? "bg-[#244f40] text-[#e5ffed]" : "bg-[#672b48] text-[#fff0f6]"}`}>
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-36 h-[380px] w-[380px] rounded-full border border-[#d9b989]/30" />
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-24 h-[300px] w-[300px] rounded-full border border-[#d9b989]/20" />
          <div aria-hidden className="pointer-events-none absolute right-12 top-7 h-[160px] w-[160px] rounded-full border border-[#d9b989]/15" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_15%,rgba(196,175,127,.24),transparent_48%),radial-gradient(ellipse_at_20%_100%,rgba(99,144,124,.25),transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e6d1a6]/45 bg-[#e6d1a6]/10 text-[#e7c992]"><Orbit size={23} strokeWidth={1.2}/></div>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[.29em] text-[#e5cf9f]" style={geometric}><Sparkles size={12}/> SHIORIVIA · STAR CHART</div>
                <h2 className="mt-2 text-[25px] font-semibold tracking-[.11em] sm:text-[30px]" style={geometric}>WORLDLINE <span className="text-[#e7c994]">/</span> {deepText(locale, "worldline.heading")}</h2>
                <p className="mt-1 text-[11px] tracking-[.12em] text-[#b8c8bc]" style={geometric}>{deepText(locale, "worldline.motto")}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label={deepText(locale, "worldline.close")} className="relative rounded-full border border-white/20 p-2 text-[#c7d6cc] transition hover:bg-white/10"><X size={18}/></button>
          </div>
          <div className={`relative mt-7 flex items-center gap-3 text-[10px] font-semibold tracking-[.18em] ${novel ? "text-[#f7d7aa]" : chat ? "text-[#b3e6c6]" : "text-[#f6bdd4]"}`} style={geometric}>
            <CircleDot size={13} className="text-[#e3c992]"/><span>WORLD</span><span className="h-px flex-1 bg-gradient-to-r from-[#cfb781]/65 to-[#658777]/20"/><span>ERA</span><span className="h-px flex-1 bg-gradient-to-r from-[#cfb781]/65 to-[#658777]/20"/><span>PERIOD</span><span className="h-px flex-1 bg-gradient-to-r from-[#cfb781]/65 to-[#658777]/20"/>{showEvent && <span>EVENT</span>}
          </div>
        </header>

        <div className={`min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-8 ${novel ? "bg-[#fff9ee]" : chat ? "bg-[#f5fcf6]" : "bg-[#fff6fa]"}`}>
          {value && <div className={`rounded-xl border-l-[3px] px-4 py-3 text-xs leading-6 ${novel ? "border-[#b8884d] bg-[#f6e8d4] text-[#785334]" : chat ? "border-[#63a081] bg-[#e2f4e8] text-[#35664e]" : "border-[#c65d88] bg-[#fce5ef] text-[#823757]"}`}><span className="font-semibold">{deepText(locale, "worldline.current")}</span><span className="mx-2 text-[#a6b5a7]">/</span>{describeStoryWorldline(value, locale)}</div>}
          {!value && legacyTimeline?.major && <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">{deepText(locale, "worldline.legacy")}{legacyTimeline.major} / {legacyTimeline.medium || deepText(locale, "worldline.unknownPeriod")}{deepText(locale, "worldline.legacyEnd")}</div>}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3"><label htmlFor="fate-world-select" className="text-xs font-bold tracking-[.14em]" style={geometric}><Globe2 size={15} className="mr-2 inline text-[#7a956e]"/>01 · WORLD / {deepText(locale, "worldline.worldLabel")}</label>{onOpenCharta && <button type="button" onClick={onOpenCharta} className="flex items-center gap-1 text-[11px] font-semibold text-[#667e6c] hover:underline">Charta · {deepText(locale, "worldline.createWorld")} <ArrowUpRight size={12}/></button>}</div>
            <select id="fate-world-select" disabled={primaryLocked} value={draft.worldId} onChange={e=>chooseWorld(e.target.value)} className={inputStyle}>{choices.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <p className="text-[11px] leading-6 text-[#7d9286]">{draft.worldDescription ? `${draft.worldDescription.slice(0,180)}${draft.worldDescription.length>180 ? "…" : ""}` : deepText(locale, "worldline.noExtraLore")}</p>
          </section>
          <section className="rounded-2xl border border-[#dbe5d9] bg-white/75 p-4 space-y-4">
            <label className="flex items-center justify-between gap-3 text-xs font-semibold text-[#496453]">
              <span>{deepText(locale, "worldline.crossWorld")} · CROSS-WORLD <span className="ml-1 text-[10px] font-normal text-[#89998d]">{deepText(locale, "worldline.defaultOff")}</span></span>
              <input type="checkbox" disabled={Boolean(value?.crossWorld?.enabled)} checked={crossWorld.enabled} onChange={e => setDraft(prev => ({
                ...prev, crossWorld: { ...crossWorld, enabled: e.target.checked, includeUniversal: e.target.checked && crossWorld.includeUniversal,
                  secondary: e.target.checked ? crossWorld.secondary : [] },
              }))} className="h-4 w-4 accent-[#577d67]" />
            </label>
            {crossWorld.enabled && <>
              <p className="text-[11px] leading-5 text-[#7a9180]">{deepText(locale, "worldline.crossHelp")}</p>
              {crossWorld.secondary.map((entry, index) => {
                const eras = [...new Set(entry.canonTimeline.map(stage => stage.era))];
                const periods = entry.canonTimeline.filter(stage => !entry.baseEra || stage.era === entry.baseEra);
                return <div key={index} className="space-y-3 rounded-xl border border-[#dae6d9] bg-[#f7faf6] p-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold">{deepText(locale, "worldline.otherWorld")} {index + 1}</span>
                    <button type="button" disabled={previousSecondary.has(entry.worldId)} onClick={() => setDraft(prev => ({ ...prev, crossWorld: { ...crossWorld,
                      secondary: crossWorld.secondary.filter((_, i) => i !== index) } }))} aria-label={deepText(locale, "worldline.removeWorld")} className="text-[#a27d73]"><Trash2 size={15}/></button></div>
                  <select disabled={previousSecondary.has(entry.worldId)} value={entry.worldId} onChange={e => changeSecondary(index, e.target.value)} className={inputStyle}>
                    {choices.filter(item => item.id === entry.worldId || (item.id !== draft.worldId && !crossWorld.secondary.some(s => s.worldId === item.id))).map(item =>
                      <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[11px] text-[#526b5b]">{deepText(locale, "worldline.baseEra")} *
                      <select disabled={previousSecondary.has(entry.worldId)} className={inputStyle} value={entry.baseEra} onChange={e => changeSecondaryBaseline(index, e.target.value, "")}>
                        <option value="">{deepText(locale, "worldline.chooseEra")}</option>{eras.map(era => <option key={era} value={era}>{displayWorldlineEra(entry.worldId, era, locale)}</option>)}
                      </select>
                    </label>
                    <label className="text-[11px] text-[#526b5b]">{deepText(locale, "worldline.basePeriod")} *
                      <select disabled={previousSecondary.has(entry.worldId)} className={inputStyle} value={entry.basePeriod}
                        onChange={e => changeSecondaryBaseline(index, entry.canonTimeline.find(stage => stage.period === e.target.value)?.era || entry.baseEra, e.target.value)}>
                        <option value="">{deepText(locale, "worldline.choosePeriod")}</option>{periods.map(stage => <option key={stage.period} value={stage.period}>{stage.period}{timelineStageDescription(stage, locale) ? " · " + timelineStageDescription(stage, locale) : ""}</option>)}
                      </select>
                    </label>
                  </div>
                </div>;
              })}
              <button type="button" disabled={crossWorld.secondary.length >= 3} onClick={addSecondary}
                className="flex items-center gap-2 rounded-lg border border-[#bad0bc] bg-[#f0f7ef] px-3 py-2 text-xs text-[#4a7059] disabled:opacity-40">
                <Plus size={14}/> {deepText(locale, "worldline.addWorld")} · {crossWorld.secondary.length}/3
              </button>
              <label className="flex items-center justify-between rounded-xl border border-[#e2e9df] bg-[#fbfdf9] px-3 py-3 text-xs">
                <span>{deepText(locale, "worldline.universal")} <span className="text-[#94a597]">{deepText(locale, "worldline.unbound")}</span></span>
                <input type="checkbox" checked={crossWorld.includeUniversal}
                  onChange={e => setDraft(prev => ({ ...prev, crossWorld: { ...crossWorld, includeUniversal: e.target.checked } }))}
                  className="h-4 w-4 accent-[#577d67]" />
              </label>
            </>}
          </section>
          <section className="space-y-3">
            <h3 className="text-xs font-bold tracking-[.14em]" style={geometric}><Compass size={15} className="mr-2 inline text-[#9d8859]"/>02 · DESTINY / {deepText(locale, "worldline.destiny")}</h3>
            <div className="grid grid-cols-2 gap-3">
              {([{id:"canon",title:deepText(locale, "worldline.original"),hint:deepText(locale, "worldline.originalHint")},{id:"au",title:"ALTERNATE / AU",hint:deepText(locale, "worldline.alternateHint")}] as const).map(mode=><button key={mode.id} type="button" disabled={primaryLocked || !stages.length} onClick={()=>setDraft(p=>({...p,kind:mode.id,era:"",period:"",baseEra:undefined,basePeriod:undefined}))} className={`relative rounded-xl border px-4 py-4 text-left transition disabled:opacity-35 ${draft.kind===mode.id ? "border-[#ab925e] bg-[#f1ede3] shadow-[inset_0_0_0_1px_#d8c79d]" : "border-[#d6dfd5] bg-white hover:border-[#b1c6b4]"}`}><span className="block text-xs font-bold tracking-wider" style={geometric}>{mode.title}</span><span className="mt-1 block text-[10px] text-[#7e9284]">{mode.hint}</span>{draft.kind===mode.id && <CircleDot size={13} className="absolute right-3 top-3 text-[#ae9364]"/>}</button>)}
            </div>
            {!stages.length && <p className="text-[11px] text-[#a17855]">{deepText(locale, "worldline.noStages")}</p>}
          </section>
          {draft.kind === "au" && <section className={`space-y-3 rounded-2xl border p-4 ${novel ? "border-[#e0c6a4] bg-[#f9edda]" : chat ? "border-[#b9dac4] bg-[#e8f6ec]" : "border-[#eab6cd] bg-[#fdeaf2]"}`}>
            <h3 className="text-xs font-bold tracking-[.12em] text-[#456b57]" style={geometric}>{deepText(locale, "worldline.auBaseline")} *</h3>
            <p className="text-[11px] leading-6 text-[#718c7a]">{deepText(locale, "worldline.auExplain")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">{deepText(locale, "worldline.baseEra")} *<select disabled={primaryLocked} className={inputStyle} value={draft.baseEra || ""} onChange={e=>setDraft(p=>({...p,baseEra:e.target.value,basePeriod:""}))}><option value="">{deepText(locale, "worldline.chooseBaseEra")}</option>{baseEras.map(era=><option key={era} value={era}>{displayWorldlineEra(draft.worldId, era, locale)}</option>)}</select></label>
              <label className="text-xs font-semibold">{deepText(locale, "worldline.basePeriod")} *<select disabled={primaryLocked} className={inputStyle} value={draft.basePeriod || ""} onChange={e=>setDraft(p=>({...p,basePeriod:e.target.value,baseEra:p.canonTimeline.find(stage=>stage.period===e.target.value)?.era || p.baseEra}))}><option value="">{deepText(locale, "worldline.chooseBasePeriod")}</option>{basePeriods.map(stage=><option key={stage.period} value={stage.period}>{stage.period}{timelineStageDescription(stage, locale) ? " · " + timelineStageDescription(stage, locale) : ""}</option>)}</select></label>
            </div>
          </section>}
          {primaryLocked && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dac9bb] bg-white/75 px-3 py-2 text-[11px]">
            <span>ERA / PERIOD {timeUnlocked ? draft.kind === "au" ? deepText(locale, "worldline.unlockAu") : deepText(locale, "worldline.unlockCanon") : deepText(locale, "worldline.locked")}</span>
            <button type="button" className="rounded-lg border border-[#cbb49b] px-3 py-1.5 font-semibold hover:bg-[#f5eee5]"
              onClick={() => { setTimeUnlocked(v => !v); setDraft(value!); setError(""); }}>
              {timeUnlocked ? deepText(locale, "worldline.relock") : deepText(locale, "worldline.unlock")}
            </button>
          </div>}
          <section className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold tracking-[.12em]" style={geometric}>03 · ERA / {deepText(locale, "worldline.eraLabel")} *
              {draft.kind==="canon" ? <select disabled={!timeEditable} value={draft.era} onChange={e=>chooseEra(e.target.value)} className={inputStyle}><option value="">{deepText(locale, "worldline.chooseEra")}</option>{eras.map(era=><option key={era} value={era}>{displayWorldlineEra(draft.worldId, era, locale)}</option>)}</select> : <input disabled={!timeEditable} value={draft.era} maxLength={100} placeholder={deepText(locale, "worldline.auEraPlaceholder")} onChange={e=>setDraft(p=>({...p,era:e.target.value}))} className={inputStyle}/>}</label>
            <label className="text-xs font-bold tracking-[.12em]" style={geometric}>04 · PERIOD / {deepText(locale, "worldline.periodLabel")} *
              {draft.kind==="canon" ? <select disabled={!timeEditable} value={draft.period} onChange={e=>choosePeriod(e.target.value)} className={inputStyle}><option value="">{deepText(locale, "worldline.choosePeriod")}</option>{periods.map(period=><option key={period} value={period}>{period}{timelineStageDescription(stages.find(s => s.period === period), locale) ? " · " + timelineStageDescription(stages.find(s => s.period === period), locale) : ""}</option>)}</select> : <input disabled={!timeEditable} value={draft.period} maxLength={100} placeholder={deepText(locale, "worldline.auPeriodPlaceholder")} onChange={e=>setDraft(p=>({...p,period:e.target.value}))} className={inputStyle}/>}</label>
          </section>
          {timeEditable && !primaryLocked && draft.kind==="canon" && <button type="button" onClick={()=>setDraft(p=>({...p,era:"",period:""}))} className="flex items-center gap-1 text-[11px] text-[#648370] hover:underline"><RotateCcw size={12}/>{deepText(locale, "worldline.resetStage")}</button>}
          {timelineStageDescription(currentStage, locale) && <div className="rounded-xl border border-[#e5d4bf] bg-white/70 px-3 py-2.5 text-xs leading-6">
            <span className="mb-1 block text-[10px] font-semibold tracking-wider opacity-60">PERIOD · {draft.period}</span>
            {timelineStageDescription(currentStage, locale)}
          </div>}
          {showEvent && <label className="block text-xs font-bold tracking-[.12em]" style={geometric}>05 · EVENT / {deepText(locale, "worldline.eventLabel")}<textarea value={draft.event} maxLength={500} rows={3} onChange={e=>setDraft(p=>({...p,event:e.target.value}))} placeholder={deepText(locale, "worldline.eventPlaceholder")} className={`${inputStyle} resize-y leading-6`}/></label>}
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
        </div>
        <footer className={`flex shrink-0 items-center justify-between border-t px-5 py-4 sm:px-8 ${novel ? "border-[#e6d3b9] bg-[#f8ecd9]" : chat ? "border-[#bed9c8] bg-[#e5f2e9]" : "border-[#eec7d7] bg-[#fbe7ef]"}`}><span className="hidden text-[10px] tracking-[.19em] text-[#879b8b] sm:block" style={geometric}>THE STORY BEGINS WITH A CHOICE.</span><div className="ml-auto flex items-center gap-3"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs text-[#6c8174] hover:bg-[#e1e9e1]">{deepText(locale, "common.cancel")}</button><button type="button" onClick={save} className={`flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-semibold text-white shadow-lg ${novel ? "bg-[#805638] shadow-[#805638]/20 hover:bg-[#67452e]" : chat ? "bg-[#367356] shadow-[#367356]/20 hover:bg-[#24583e]" : "bg-[#ae3d69] shadow-[#ae3d69]/20 hover:bg-[#8c2b51]"}`}><Check size={15}/>{deepText(locale, "worldline.seal")}</button></div></footer>
      </motion.section>
    </motion.div>}
  </AnimatePresence>, document.body);
}
