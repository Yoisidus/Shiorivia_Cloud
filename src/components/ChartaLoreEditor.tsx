"use client";

import { useMemo } from "react";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import { Plus, Trash2, Clock3, Users, BookOpen, Feather, Sparkles } from "lucide-react";
import type { ChartaCharacter } from "../lib/charta";
import { CHAR_DATA } from "../data/char_config";
import type { ChartaTimelineStage } from "../lib/chartaWorld";
import {
  type ChartaLoreProfile, type ChartaRelationship, type ChartaExperience,
  validateChartaTimelineLinks, validateChartaRelationshipTargets,
} from "../lib/chartaLore";

const field = "mt-2 w-full rounded-xl border border-[#d7e0d6] bg-[#fbfcf9] px-3 py-3 text-sm leading-6 text-[#2d4739] outline-none focus:border-[#789e83]";
const head = "flex flex-wrap items-center justify-between gap-2 text-xs font-bold tracking-[.08em] text-[#547562]";
const panel = "space-y-3 rounded-2xl border border-[#dce6dc] bg-[#fcfdfa] p-4";
const uid = (prefix: string) => prefix + "-" + (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export function ChartaTimelineRangePicker({ periods, stages, onChange }: {
  periods: string[]; stages: readonly ChartaTimelineStage[]; onChange: (value: string[]) => void;
}) {
  const { locale } = useLanguage();
  const start = periods.length ? stages.findIndex(s => s.period === periods[0]) : -1;
  const end = periods.length ? stages.findIndex(s => s.period === periods[periods.length - 1]) : -1;
  const chosen = start >= 0 && end >= start;
  const setRange = (a: number, b: number) => onChange(a < 0 || b < 0 ? [] : stages.slice(Math.min(a,b), Math.max(a,b) + 1).map(s => s.period));
  return <div className="space-y-2 rounded-xl border border-[#dbe6dc] bg-white px-3 py-3">
    <div className="flex items-center gap-2 text-xs text-[#5c7b65]"><Clock3 size={14}/>{deepText(locale, "charta.lore.timelineLink")}</div>
    {!stages.length
      ? <p className="text-[11px] leading-5 text-amber-700">{deepText(locale, "charta.lore.noTimeline")}</p>
      : <>
        <label className="flex items-center gap-2 text-xs text-[#637e6a]"><input type="checkbox" checked={chosen} onChange={e=>onChange(e.target.checked ? [stages[0].period] : [])}/>{deepText(locale, "charta.lore.futureEffect")}</label>
        {chosen && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] text-[#65806d]">{deepText(locale, "charta.lore.startPeriod")}
            <select value={stages[start]?.period || ""} onChange={e=>setRange(stages.findIndex(s=>s.period===e.target.value),end)} className={field}>{stages.map(s=><option key={s.period} value={s.period}>{s.era} · {s.period}</option>)}</select>
          </label>
          <label className="text-[11px] text-[#65806d]">{deepText(locale, "charta.lore.endPeriod")}
            <select value={stages[end]?.period || ""} onChange={e=>setRange(start,stages.findIndex(s=>s.period===e.target.value))} className={field}>{stages.map(s=><option key={s.period} value={s.period}>{s.era} · {s.period}</option>)}</select>
          </label>
        </div>}
        {chosen ? <p className="text-[11px] leading-5 text-[#77907d]">{deepText(locale, "charta.lore.selectedPrefix")} {periods.length} {deepText(locale, "charta.lore.selectedSuffix")}</p>
          : <p className="text-[11px] leading-5 text-amber-700">{deepText(locale, "charta.lore.allPeriods")}</p>}
      </>}
  </div>;
}

export function ChartaLoreEditor({ value, onChange, stages, characters, currentId, worldId, selfId, selves = [] }: {
  value: ChartaLoreProfile;
  onChange: (next: ChartaLoreProfile) => void;
  stages: readonly ChartaTimelineStage[];
  characters: ChartaCharacter[];
  currentId: string;
  worldId?: string;
  selfId?: string;
  selves?: {id:string;worldId?:string;names:Record<string,string>;primaryLanguage:string}[];
}) {
  const { locale } = useLanguage();
  // Only candidates from this profile's own world; built-in BanG Dream cast
  // is available when worldId === bang-dream. Unknown characters can be typed.
  const eligible = useMemo(() => [
    ...(worldId === "bang-dream" ? CHAR_DATA.map(c => ({ id:c.id, name:c.name })) : []),
    ...characters.filter(c => c.id!==currentId && worldId && c.worldId === worldId)
      .map(c=>({ id:c.id, name:c.names[c.primaryLanguage] || Object.values(c.names)[0] || c.id })),
    ...selves.filter(c=>c.id !== selfId && worldId && c.worldId === worldId)
      .map(c=>({ id:c.id, name:c.names[c.primaryLanguage] || Object.values(c.names)[0] || c.id })),
  ], [characters,currentId,worldId,selves,selfId]);
  const patch = (key: keyof ChartaLoreProfile, content: string) => onChange({ ...value, [key]: content });
  const newRelation = () => onChange({...value, relationships:[...value.relationships,{
    id:uid("relation"), targetName:"", content:"", periods:[]
  }]});
  const newExperience = () => onChange({...value, experiences:[...value.experiences,{
    id:uid("experience"),content:"",periods:[]
  }]});
  const updateRelation = (id: string, diff: Partial<ChartaRelationship>) =>
    onChange({...value, relationships:value.relationships.map(r=>r.id===id?{...r,...diff}:r)});
  const updateExperience = (id: string, diff: Partial<ChartaExperience>) =>
    onChange({...value, experiences:value.experiences.map(e=>e.id===id?{...e,...diff}:e)});
  const timelineError = validateChartaTimelineLinks(value, stages);
  const relationshipError = validateChartaRelationshipTargets(value, worldId, [...characters, ...selves]);
  return <section className="space-y-7" aria-label={deepText(locale, "charta.lore.profile")}>
    <div className="space-y-2"><h3 className={head}><span><BookOpen size={15} className="mr-2 inline"/>03 · {deepText(locale, "charta.lore.intro")} *</span></h3>
      <textarea value={value.intro} onChange={e=>patch("intro",e.target.value)} maxLength={20000} rows={6} placeholder={deepText(locale, "charta.lore.introPlaceholder")} className={field}/>
    </div>
    <div className="space-y-2"><h3 className={head}><span><Feather size={15} className="mr-2 inline"/>04 · {deepText(locale, "charta.lore.personality")}</span><span className="font-normal text-[#8aa18d]">{deepText(locale, "common.optional")}</span></h3>
      <textarea value={value.personality} onChange={e=>patch("personality",e.target.value)} maxLength={20000} rows={7} placeholder={deepText(locale, "charta.lore.personalityPlaceholder")} className={field}/>
    </div>
    <div className="space-y-3">
      <div className={head}><span><Users size={15} className="mr-2 inline"/>05 · {deepText(locale, "charta.lore.relationships")}</span><button type="button" onClick={newRelation} disabled={value.relationships.length>=100} className="inline-flex items-center gap-1 rounded-xl border border-[#b8cdbb] px-3 py-2 text-xs font-medium text-[#567960] disabled:opacity-40"><Plus size={14}/>{deepText(locale, "charta.lore.addRelation")}</button></div>
      <textarea value={value.relationshipNotes} onChange={e=>patch("relationshipNotes",e.target.value)} maxLength={20000} rows={4} placeholder={deepText(locale, "charta.lore.relationNotes")} className={field}/>
      {value.relationships.map((rel,i)=><div key={rel.id} className={panel}>
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#53785f]">{deepText(locale, "charta.lore.relation")} #{i+1}</p><button type="button" aria-label={`${deepText(locale, "charta.lore.removeRelation")} ${i+1}`} onClick={()=>onChange({...value,relationships:value.relationships.filter(r=>r.id!==rel.id)})} className="rounded-lg p-2 text-[#b17c77] hover:bg-rose-50"><Trash2 size={15}/></button></div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="text-xs text-[#65806d]">{deepText(locale, "charta.lore.target")} *
            <input value={rel.targetName} maxLength={100} onChange={e=>updateRelation(rel.id,{targetName:e.target.value,targetId:undefined})} placeholder={deepText(locale, "charta.lore.targetPlaceholder")} className={field}/>
          </label>
          <label className="text-xs text-[#65806d]">{deepText(locale, "charta.lore.selectCharacter")}
            <select value={rel.targetId || ""} onChange={e=>{const target=eligible.find(item=>item.id===e.target.value);updateRelation(rel.id,{targetId:target?.id,targetName:target?.name||rel.targetName});}} className={field}>
              <option value="">{deepText(locale, "charta.lore.manualName")}</option>{eligible.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs text-[#65806d]">{deepText(locale, "charta.lore.relationChange")}
          <textarea value={rel.content} onChange={e=>updateRelation(rel.id,{content:e.target.value})} maxLength={12000} rows={5} placeholder={deepText(locale, "charta.lore.relationPlaceholder")} className={field}/>
        </label>
        <ChartaTimelineRangePicker periods={rel.periods} stages={stages} onChange={periods=>updateRelation(rel.id,{periods})}/>
      </div>)}
      {!value.relationships.length && <p className="text-[11px] text-[#91a392]">{deepText(locale, "charta.lore.noRelations")}</p>}
    </div>
    <div className="space-y-3">
      <div className={head}><span><BookOpen size={15} className="mr-2 inline"/>06 · {deepText(locale, "charta.lore.experiences")}</span><button type="button" onClick={newExperience} disabled={value.experiences.length>=100} className="inline-flex items-center gap-1 rounded-xl border border-[#b8cdbb] px-3 py-2 text-xs font-medium text-[#567960] disabled:opacity-40"><Plus size={14}/>{deepText(locale, "charta.lore.addExperience")}</button></div>
      <textarea value={value.experienceNotes} onChange={e=>patch("experienceNotes",e.target.value)} maxLength={20000} rows={9} placeholder={deepText(locale, "charta.lore.experienceNotes")} className={field}/>
      {value.experiences.map((exp,i)=><div key={exp.id} className={panel}>
        <div className="flex justify-between"><p className="text-xs font-semibold text-[#53785f]">{deepText(locale, "charta.lore.linkedExperience")} #{i+1}</p><button type="button" aria-label={`${deepText(locale, "charta.lore.removeExperience")} ${i+1}`} onClick={()=>onChange({...value,experiences:value.experiences.filter(e=>e.id!==exp.id)})} className="p-2 text-[#b17c77] hover:bg-rose-50"><Trash2 size={15}/></button></div>
        <textarea value={exp.content} onChange={e=>updateExperience(exp.id,{content:e.target.value})} maxLength={12000} rows={7} placeholder={deepText(locale, "charta.lore.experiencePlaceholder")} className={field}/>
        <ChartaTimelineRangePicker periods={exp.periods} stages={stages} onChange={periods=>updateExperience(exp.id,{periods})}/>
      </div>)}
    </div>
    <div className="space-y-2"><h3 className={head}><span><Sparkles size={15} className="mr-2 inline"/>07 · {deepText(locale, "charta.lore.guidance")}</span><span className="font-normal text-[#8aa18d]">{deepText(locale, "common.optional")}</span></h3>
      <textarea value={value.guidance} onChange={e=>patch("guidance",e.target.value)} maxLength={20000} rows={6} placeholder={deepText(locale, "charta.lore.guidancePlaceholder")} className={field}/>
    </div>
    {relationshipError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{relationshipError}</p>}
    {timelineError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{timelineError}</p>}
    <p className="text-[11px] leading-6 text-[#889d8d]">{deepText(locale, "charta.lore.generalHelp")}</p>
  </section>;
}
