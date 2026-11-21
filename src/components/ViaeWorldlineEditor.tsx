"use client";
import { Plus, Trash2, Globe2 } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import type { ChartaWorld } from "../lib/chartaWorld";
import { canExtendWorldline } from "../lib/worldlineLock";
import { BANG_DREAM_WORLD_ID, BANG_DREAM_WORLD_NAME, BANG_DREAM_CANON, worldlineFor, worldlineStageIndex, timelineStageDescription, type StoryWorldline } from "../lib/storyWorldline";

const selectStyle = "mt-1 w-full rounded-lg border border-[#dfe6eb] bg-white px-3 py-2.5 text-xs text-[#253f58] outline-none focus:border-[#bfaa7b]";
const rowStyle = "rounded-xl border border-[#e7e9ea] bg-[#fcfcfa] p-3";
const worldsList = (worlds: ChartaWorld[]) => [
  { id: BANG_DREAM_WORLD_ID, name: BANG_DREAM_WORLD_NAME, description: "", canonTimeline: BANG_DREAM_CANON },
  ...worlds,
];

export function ViaeWorldlineEditor({ value, onChange, worlds, saved }: {
  value: StoryWorldline;
  onChange: (next: StoryWorldline) => void;
  worlds: ChartaWorld[];
  saved?: StoryWorldline;
}) {
  const { locale } = useLanguage();
  const [timeUnlocked, setTimeUnlocked] = useState(false);
  const available = worldsList(worlds);
  const primaryLocked = Boolean(saved);
  const timeEditable = !primaryLocked || timeUnlocked;
  const minIndex = saved?.kind === "canon" ? worldlineStageIndex(saved) : -1;
  const safeChange = (next: StoryWorldline) => { if (!saved || canExtendWorldline(saved, next)) onChange(next); };
  const protectedSecondary = new Set(saved?.crossWorld?.secondary.map(w => w.worldId) || []);
  const stages = value.canonTimeline || [];
  const cross = value.crossWorld || { enabled: false, includeUniversal: false, secondary: [] };
  // Secondary-world drafts temporarily lack baselines; validate the full snapshot only on Save.
  const modifyCross = (next: typeof cross) => onChange({ ...value, crossWorld: next });
  const changeWorld = (id: string) => {
    if (primaryLocked) return;
    const chosen = available.find(w => w.id === id);
    const next = chosen?.id === BANG_DREAM_WORLD_ID ? worldlineFor(null)
      : worldlineFor(worlds.find(w => w.id === id) || null);
    onChange(next);
  };
  const chooseSecondary = (index: number, id: string) => {
    if (protectedSecondary.has(cross.secondary[index]?.worldId)) return;
    const w = available.find(item => item.id === id);
    if (!w) return;
    modifyCross({ ...cross, secondary: cross.secondary.map((entry, i) => i === index
      ? { worldId: w.id, worldName: w.name, worldDescription: w.description,
        canonTimeline: w.canonTimeline, baseEra: "", basePeriod: "" } : entry) });
  };
  const addSecondary = () => {
    if (cross.secondary.length >= 3) return;
    const next = available.find(w => w.id !== value.worldId && !cross.secondary.some(c => c.worldId === w.id));
    if (!next) return;
    modifyCross({ ...cross, secondary: [...cross.secondary, {
      worldId: next.id, worldName: next.name, worldDescription: next.description,
      canonTimeline: next.canonTimeline, baseEra: "", basePeriod: "",
    }] });
  };
  const base = stages.filter(s => !value.baseEra || s.era === value.baseEra);
  const periods = stages.filter((s, index) => (minIndex < 0 || index >= minIndex) && (!value.era || s.era === value.era));
  const eras = [...new Set(stages.filter((s,index) => minIndex < 0 || index >= minIndex).map(s => s.era))];
  return (
    <div className="space-y-4 text-[#29445c]">
      <div className="flex items-center gap-2 text-xs font-semibold"><Globe2 size={15} className="text-[#b69a64]"/> WORLDLINE / {deepText(locale, "viae.worldline.title")}</div>
      <label className="block text-[11px] font-medium text-[#64788a]">{deepText(locale, "viae.worldline.primary")} · WORLD *
        <select disabled={primaryLocked} value={value.worldId} onChange={e => changeWorld(e.target.value)} className={selectStyle}>
          {available.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <div className="flex gap-2">
        {(["canon", "au"] as const).map(kind =>
          <button key={kind} type="button" aria-pressed={value.kind === kind}
            disabled={primaryLocked} onClick={() => safeChange({ ...value, kind, era: "", period: "", baseEra: undefined, basePeriod: undefined })}
            className={`rounded-lg border px-4 py-2 text-xs ${value.kind === kind ? "border-[#bda475] bg-[#fff8e9] text-[#795e2f]" : "border-[#e1e6eb] bg-white text-[#8090a1]"}`}>
            {`${deepText(locale, kind === "canon" ? "viae.worldline.canon" : "viae.worldline.au")} · ${kind === "canon" ? "ORIGINAL" : "AU"}`}</button>)}
      </div>
      {value.kind === "au" && <div className={rowStyle}>
        <p className="mb-2 text-[11px] text-[#718495]">{deepText(locale, "viae.worldline.baselineHelp")}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px]">{deepText(locale, "worldline.baseEra")} *<select value={value.baseEra || ""} className={selectStyle}
            disabled={primaryLocked} onChange={e => safeChange({ ...value, baseEra: e.target.value, basePeriod: undefined })}>
            <option value="">{deepText(locale, "worldline.chooseEra")}</option>{eras.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="text-[11px]">{deepText(locale, "worldline.basePeriod")} *<select value={value.basePeriod || ""} className={selectStyle}
            disabled={primaryLocked} onChange={e => safeChange({ ...value, basePeriod: e.target.value, baseEra: stages.find(s => s.period === e.target.value)?.era || value.baseEra })}>
            <option value="">{deepText(locale, "worldline.choosePeriod")}</option>{base.map(s => <option key={s.period} value={s.period}>{s.period}</option>)}</select></label>
        </div>
      </div>}
      {primaryLocked && <div className="flex items-center justify-between gap-2 rounded-lg border border-[#e1d3b7] bg-[#fffaf0] px-3 py-2 text-[11px]">
        <span>{deepText(locale, "viae.worldline.timeline")}{timeUnlocked ? deepText(locale, "viae.worldline.unlocked") : deepText(locale, "worldline.locked")}</span>
        <button type="button" className="rounded border border-[#d5c39e] px-2 py-1" onClick={() => { setTimeUnlocked(v => !v); onChange(saved!); }}>{deepText(locale, timeUnlocked ? "worldline.relock" : "worldline.unlock")}</button>
      </div>}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]">ERA · {deepText(locale, "worldline.eraLabel")} *{value.kind === "canon"
          ? <select disabled={!timeEditable} value={value.era} className={selectStyle} onChange={e => { const candidate = stages.find((s,index) => s.era === e.target.value && (minIndex < 0 || index >= minIndex)); if(candidate) safeChange({ ...value, era: candidate.era, period: candidate.period }); }}>
              <option value="">{deepText(locale, "worldline.chooseEra")}</option>{eras.map(v => <option key={v} value={v}>{v}</option>)}</select>
          : <input disabled={primaryLocked} value={value.era} maxLength={100} onChange={e => safeChange({ ...value, era: e.target.value })} className={selectStyle} placeholder={deepText(locale, "worldline.auEraPlaceholder")}/>}</label>
        <label className="text-[11px]">PERIOD · {deepText(locale, "worldline.periodLabel")} *{value.kind === "canon"
          ? <select disabled={!timeEditable} value={value.period} className={selectStyle} onChange={e => safeChange({
              ...value, period: e.target.value, era: stages.find(s => s.period === e.target.value)?.era || value.era })}>
              <option value="">{deepText(locale, "worldline.choosePeriod")}</option>{periods.map(s => <option key={s.period} value={s.period}>{s.period}{timelineStageDescription(s, locale) ? " · " + timelineStageDescription(s, locale) : ""}</option>)}</select>
          : <input disabled={primaryLocked} value={value.period} maxLength={100} onChange={e => safeChange({ ...value, period: e.target.value })} className={selectStyle} placeholder={deepText(locale, "worldline.auPeriodPlaceholder")}/>}</label>
      </div>
      {timelineStageDescription(stages.find(s => s.era === value.era && s.period === value.period), locale) && <p className="rounded-lg bg-[#f9f4e8] px-3 py-2 text-[11px] leading-5 text-[#846b49]">{timelineStageDescription(stages.find(s => s.era === value.era && s.period === value.period), locale)}</p>}
      <div className={rowStyle}>
        <label className="flex items-center justify-between gap-2 text-xs font-semibold">
          {deepText(locale, "worldline.crossWorld")} · CROSS-WORLD <input type="checkbox" disabled={Boolean(saved?.crossWorld?.enabled)} checked={cross.enabled}
            onChange={e => modifyCross({ ...cross, enabled: e.target.checked, includeUniversal: e.target.checked && cross.includeUniversal,
              secondary: e.target.checked ? cross.secondary : [] })} className="h-4 w-4 accent-[#b59b66]"/>
        </label>
        {cross.enabled && <div className="mt-3 space-y-3">
          <p className="text-[11px] leading-5 text-[#8493a1]">{deepText(locale, "worldline.crossHelp")}</p>
          {cross.secondary.map((entry, index) => {
            const eras = [...new Set(entry.canonTimeline.map(s => s.era))];
            const periods = entry.canonTimeline.filter(s => !entry.baseEra || s.era === entry.baseEra);
            return <div key={index} className="space-y-2 rounded-lg border border-[#e4e7e7] bg-white p-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>{deepText(locale, "worldline.otherWorld")} {index + 1}</span>
                <button type="button" disabled={protectedSecondary.has(entry.worldId)} aria-label={deepText(locale, "worldline.removeWorld")} onClick={() => modifyCross({ ...cross, secondary: cross.secondary.filter((_, i) => i !== index) })}><Trash2 size={14}/></button>
              </div>
              <select disabled={protectedSecondary.has(entry.worldId)} value={entry.worldId} className={selectStyle} onChange={e => chooseSecondary(index, e.target.value)}>
                {available.filter(w => w.id === entry.worldId || (w.id !== value.worldId && !cross.secondary.some(s => s.worldId === w.id))).map(w =>
                  <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px]">{deepText(locale, "worldline.baseEra")} *<select disabled={protectedSecondary.has(entry.worldId)} value={entry.baseEra} className={selectStyle}
                  onChange={e => modifyCross({ ...cross, secondary: cross.secondary.map((s, i) => i === index ? { ...s, baseEra: e.target.value, basePeriod: "" } : s) })}>
                  <option value="">{deepText(locale, "worldline.chooseEra")}</option>{eras.map(era => <option key={era} value={era}>{era}</option>)}</select></label>
                <label className="text-[11px]">{deepText(locale, "worldline.basePeriod")} *<select disabled={protectedSecondary.has(entry.worldId)} value={entry.basePeriod} className={selectStyle}
                  onChange={e => modifyCross({ ...cross, secondary: cross.secondary.map((s, i) => i === index
                    ? { ...s, basePeriod: e.target.value, baseEra: s.canonTimeline.find(t => t.period === e.target.value)?.era || s.baseEra } : s) })}>
                  <option value="">{deepText(locale, "worldline.choosePeriod")}</option>{periods.map(p => <option key={p.period} value={p.period}>{p.period}</option>)}</select></label>
              </div>
            </div>;
          })}
          <button type="button" onClick={addSecondary} disabled={cross.secondary.length >= 3 ||
            available.every(w => w.id === value.worldId || cross.secondary.some(s => s.worldId === w.id))}
            className="flex items-center gap-1.5 rounded-lg border border-[#d9cead] px-3 py-2 text-xs text-[#8c7547] disabled:opacity-40">
            <Plus size={13}/> {deepText(locale, "worldline.addWorld")} ({cross.secondary.length}/3)
          </button>
          <label className="flex items-center justify-between rounded-lg bg-[#f8fafb] px-3 py-2 text-xs">
            {deepText(locale, "worldline.universal")} <input type="checkbox" checked={cross.includeUniversal}
              onChange={e => modifyCross({ ...cross, includeUniversal: e.target.checked })} className="h-4 w-4 accent-[#b59b66]"/>
          </label>
        </div>}
      </div>
    </div>
  );
}
