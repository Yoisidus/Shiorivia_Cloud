"use client";
import { useCallback, useEffect, useState } from "react";
import { browserRead, browserWrite } from "../lib/browserStore";
import { parseChartaWorld, type ChartaWorld } from "../lib/chartaWorld";

const KEY="charta:worlds";
export function useChartaWorlds() {
  const [worlds,setWorlds]=useState<ChartaWorld[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let alive=true;
    browserRead<unknown[]>(KEY,[]).then(items=>items.map(parseChartaWorld)).then(items=>{
      if(alive){setWorlds(items);setLoaded(true);setError("");}
    }).catch(e=>{if(alive)setError(String(e?.message||e));});
    return ()=>{alive=false;};
  },[]);
  const persist=useCallback(async (items:ChartaWorld[])=>{
    if(!loaded)return false;
    try {
      const validated=items.map(parseChartaWorld);
      await browserWrite(KEY,validated);
      setWorlds(validated);setError("");return true;
    } catch(e){setError(e instanceof Error?e.message:"Browser save failed.");return false;}
  },[loaded]);
  const saveWorld=useCallback((entry:ChartaWorld)=>{
    const valid=parseChartaWorld(entry);
    return persist([valid,...worlds.filter(w=>w.id!==valid.id)]);
  },[worlds,persist]);
  const removeWorld=useCallback((id:string)=>persist(worlds.filter(w=>w.id!==id)),[worlds,persist]);
  return {worlds,loaded,error,saveWorld,removeWorld};
}
