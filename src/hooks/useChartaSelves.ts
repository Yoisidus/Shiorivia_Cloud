"use client";
import { useCallback, useEffect, useState } from "react";
import { browserRead, browserWrite } from "../lib/browserStore";
import { parseChartaSelf, type ChartaSelf } from "../lib/chartaSelf";

type StoredSelf={selves:ChartaSelf[];activeId:string|null};
const KEY="charta:selves";
export function useChartaSelves(){
  const [selves,setSelves]=useState<ChartaSelf[]>([]);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let alive=true;
    browserRead<StoredSelf>(KEY,{selves:[],activeId:null}).then(raw=>{
      const entries=(raw.selves||[]).map(parseChartaSelf);
      const active=typeof raw.activeId==="string"&&entries.some(s=>s.id===raw.activeId)?raw.activeId:null;
      if(alive){setSelves(entries);setActiveId(active);setLoaded(true);setError("");}
    }).catch(e=>{if(alive)setError(String(e?.message||e));});
    return()=>{alive=false;};
  },[]);
  const persist=useCallback(async(next:ChartaSelf[],active:string|null):Promise<boolean>=>{
    if(!loaded)return false;
    try {
      const valid=next.map(parseChartaSelf);
      const validActive=active&&valid.some(s=>s.id===active)?active:null;
      await browserWrite(KEY,{selves:valid,activeId:validActive});
      setSelves(valid);setActiveId(validActive);setError("");return true;
    } catch(e){setError(e instanceof Error?e.message:"Browser save failed.");return false;}
  },[loaded]);
  const saveSelf=useCallback((entry:ChartaSelf)=>{
    const parsed=parseChartaSelf(entry);
    return persist([parsed,...selves.filter(s=>s.id!==parsed.id)],activeId);
  },[selves,activeId,persist]);
  const removeSelf=useCallback((id:string)=>persist(selves.filter(s=>s.id!==id),activeId===id?null:activeId),[selves,activeId,persist]);
  const selectSelf=useCallback((id:string|null)=>persist(selves,id),[selves,persist]);
  const activeSelf=selves.find(s=>s.id===activeId)||null;
  return {selves,activeId,activeSelf,loaded,error,saveSelf,removeSelf,selectSelf};
}
