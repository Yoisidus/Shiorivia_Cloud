"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Download, Trash2, X, Camera, HardDrive, Loader2, Sparkles, Orbit } from "lucide-react";
import { browserRead, browserWrite } from "../lib/browserStore";
import { useAppDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { deepText } from '../lib/i18nDeep';

export const SaveLoadModal = ({ isOpen, onClose, currentSession, onLoadSession }: any) => {
    const dialog = useAppDialog();
    const { locale } = useLanguage();
    const slotText = (key: string, index: number) => deepText(locale, `archive.ui.${key}`).replace("{index}", String(index));
    const [slots, setSlots] = useState<Record<number, any>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isCapturing] = useState(false);

    const fetchSlots = async () => {
        setIsLoading(true);
        try {
            const entries = await browserRead<Record<number, {session:any;timestamp:number;previewText:string;slotIndex:number}>>("archive:slots", {});
            const map: Record<number,any> = {};
            for (const [index,entry] of Object.entries(entries)) map[Number(index)]={...entry,thumbnail:null};
            setSlots(map);
        } catch (error) {
            dialog.notify(deepText(locale, "archive.ui.loadFailed"));
        } finally { setIsLoading(false); }
    };
    useEffect(() => { if (isOpen) void fetchSlots(); }, [isOpen]);

    const handleSave = async (index:number) => {
        if (!currentSession) return;
        if (slots[index] && !await dialog.confirm(slotText("overwrite",index+1))) return;
        setIsLoading(true);
        try {
            const previous=await browserRead<Record<number, any>>("archive:slots",{});
            const last=currentSession.messages[currentSession.messages.length-1];
            const previewText=typeof last?.content==="string"?last.content.slice(0,45):"";
            const next={...previous,[index]:{slotIndex:index,session:currentSession,timestamp:Date.now(),previewText}};
            await browserWrite("archive:slots",next);
            await fetchSlots();
        } catch { dialog.notify(deepText(locale,"archive.ui.saveFailed")); }
        finally { setIsLoading(false); }
    };
    const handleLoad = async (index:number) => {
        if (!await dialog.confirm(slotText("loadAsk",index+1))) return;
        setIsLoading(true);
        try {
            const slots=await browserRead<Record<number, any>>("archive:slots",{});
            if (!slots[index]?.session)throw Error("Slot unavailable");
            onLoadSession(slots[index].session);
            onClose();
        } catch { dialog.notify(deepText(locale,"archive.ui.loadFailed")); }
        finally {setIsLoading(false);}
    };
    const handleDelete = async (event:React.MouseEvent,index:number) => {
        event.stopPropagation();
        if (!await dialog.confirm(deepText(locale,"archive.ui.deleteAsk"))) return;
        setIsLoading(true);
        try {
            const stored=await browserRead<Record<number,any>>("archive:slots",{});
            const updated={...stored};
            delete updated[index];
            await browserWrite("archive:slots",updated);
            await fetchSlots();
        } catch { dialog.notify(deepText(locale,"archive.ui.saveFailed")); }
        finally { setIsLoading(false); }
    };

    if (isCapturing) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center bg-[#112521]/75 p-3 backdrop-blur-[9px] sm:p-6">
                    <motion.div initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} className="flex h-[87dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[#d9e4d6] bg-[#f7faf5] shadow-[0_35px_100px_rgba(7,35,27,.5)]">
                        
                        <div className="relative isolate flex shrink-0 items-center justify-between overflow-hidden border-b border-[#b8c6b8]/20 bg-[#1d3933] px-5 py-5 text-[#f3f6eb] sm:px-8 sm:py-6">
                            <div aria-hidden className="pointer-events-none absolute -right-8 -top-24 h-64 w-64 rounded-full border border-[#cfb985]/30" />
                            <div aria-hidden className="pointer-events-none absolute right-4 top-0 h-32 w-32 rounded-full border border-[#cfb985]/20" />
                            <div className="relative flex items-center gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d9c397]/40 bg-[#e6ce9c]/10 text-[#e4c997]"><Orbit size={24} strokeWidth={1.3}/></div>
                                <div><div className="flex items-center gap-2 text-[10px] font-semibold tracking-[.25em] text-[#dbc998]"><Sparkles size={12}/> SHIORIVIA · STAR ARCHIVE</div><h2 className="mt-1 text-xl font-semibold tracking-[.14em]" style={{ fontFamily: 'Bahnschrift, "Arial Narrow", sans-serif' }}>BROWSER STORAGE <span className="font-normal text-[#b9cab8]">/ {deepText(locale, "archive.ui.title")}</span></h2><p className="mt-1 text-[11px] text-[#b7c8bb]">{deepText(locale, "archive.ui.subtitle")}</p></div>
                            </div>
                            <button type="button" onClick={onClose} aria-label={deepText(locale, "archive.ui.close")} className="relative rounded-full border border-white/20 p-2 text-[#cfdbcf] hover:bg-white/10"><X size={20}/></button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_15%_0%,#e6efe5_0%,transparent_53%),radial-gradient(ellipse_at_95%_95%,#f3efdf_0%,transparent_50%)] p-4 sm:p-7">
                            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#dbe4d8] pb-3"><span className="text-[11px] font-bold tracking-[.17em] text-[#68806d]">ARCHIVED TIMELINES · 12 SLOTS</span><span className="text-[11px] text-[#8c9e8e]">{Object.keys(slots).length} / 12 {deepText(locale, "archive.ui.saved")} {isLoading && <Loader2 size={12} className="ml-1 inline animate-spin"/>}</span></div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
                                {Array.from({ length: 12 }).map((_, i) => {
                                    const slot = slots[i];
                                    return (
                                        <div key={i} className={`relative group flex aspect-[1.48] flex-col overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${slot ? 'border-[#c4d9c6] bg-white' : 'border-[#e0e8dc] bg-white/90 hover:border-[#a8c3aa]'}`}>
                                            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#e9f0e8]">
                                                {slot?.thumbnail ? (
                                                    <img src={slot.thumbnail} alt={slotText("thumbnail", i + 1)} className="h-full w-full object-cover opacity-85 transition-opacity duration-500 group-hover:opacity-100"/>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-[#adbea9]"><Sparkles size={24} strokeWidth={1}/><span className="text-3xl font-light tracking-[.2em]">{String(i+1).padStart(2, "0")}</span><span className="text-[10px] tracking-[.16em]">EMPTY / {deepText(locale, "archive.ui.empty")}</span></div>
                                                )}
                                                
                                                <div className="absolute inset-0 flex items-center justify-center gap-4 bg-[#142b27]/75 opacity-100 backdrop-blur-[2px] transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                                    <button type="button" disabled={isLoading || !currentSession} onClick={(e)=>{e.stopPropagation(); void handleSave(i)}} aria-label={slotText("saveSlot", i + 1)} className="flex flex-col items-center gap-1 rounded-lg p-2 text-[#eff8e9] hover:bg-white/10 hover:text-[#e0c896] disabled:opacity-40"><Save size={22}/><span className="text-[10px] font-bold tracking-wider">{deepText(locale, "common.save")}</span></button>
                                                    {slot && <button type="button" disabled={isLoading} onClick={(e)=>{e.stopPropagation(); void handleLoad(i)}} aria-label={slotText("loadSlot", i + 1)} className="flex flex-col items-center gap-1 rounded-lg p-2 text-[#eff8e9] hover:bg-white/10 hover:text-[#c1dcca] disabled:opacity-40"><Download size={22}/><span className="text-[10px] font-bold tracking-wider">{deepText(locale, "archive.ui.load")}</span></button>}
                                                    {slot && <button type="button" disabled={isLoading} onClick={(e)=>{e.stopPropagation(); void handleDelete(e, i)}} aria-label={slotText("deleteSlot", i + 1)} className="flex flex-col items-center gap-1 rounded-lg p-2 text-[#eff8e9] hover:bg-white/10 hover:text-[#f0b4ae] disabled:opacity-40"><Trash2 size={22}/><span className="text-[10px] font-bold tracking-wider">{deepText(locale, "common.delete")}</span></button>}
                                                </div>
                                            </div>

                                            <div className="flex h-[58px] flex-col justify-center border-t border-[#e0e8df] bg-[#fafcf8] px-4">
                                                <div className="flex justify-between items-center">
                                                    <span className={`text-[11px] font-bold tracking-[.16em] ${slot ? 'text-[#406b50]' : 'text-[#a7b4a7]'}`}>SLOT {String(i+1).padStart(2, "0")}</span>
                                                    {slot && <span className="text-[10px] text-[#8b9a88]">{new Date(slot.timestamp).toLocaleDateString()}</span>}
                                                </div>
                                                {slot && <div className="mt-1 truncate text-[10px] text-[#768d7c]">{slot.previewText}</div>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};