"use client";
import React, { useState, useEffect } from "react"; 
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, User, Heart, Zap, Skull, Thermometer, Shirt, Footprints, Sparkles, ChevronLeft, Send, Lock, Check, Brain, TreeDeciduous, X } from "lucide-react";
import { CHAR_DATA } from "../data/char_config";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import { characterDisplayName } from "../lib/characterNames";
import { useAppDialog } from "../context/DialogContext";
import { StoryWorldlineFateModal } from "./StoryWorldlineFateModal";
import { StoryCastPicker } from "./StoryCastPicker";
import { describeStoryWorldline, type StoryWorldline } from "../lib/storyWorldline";
import { canExtendWorldline } from "../lib/worldlineLock";
import { storyCastAllowed } from "../lib/storyCast";
import { isEngineeringCharacterLocked } from "../lib/engineeringSession";
import { selfName } from "../lib/chartaSelf";

const SidebarRightComponent = ({
    isOpen, onClose,
    activeCharacterId, setActiveCharacterId,
    createNewSession,
    currentSession,
    onOpenMemory,
    handleSend,
    setSessions,
    currentSessionId,
    onRepoUpdate, 
    onCharSwitch,
    dbChars,
    currentBgmId, setBgmId,
    activeStorySelf, storySelf, onStoryRoleChange, onStoryPovChange,
    worlds = [], customCharacters = [], isGenerating = false, setInput, onOpenChartaWorld, worldlineOpenSignal = 0
}: any) => {

    const isStoryMode = currentSession?.memoryMode === 'sliding';

    const rawStats = currentSession?.charStatus;
    const charList = isStoryMode && currentSession?.storyRole !== 'participant' && !currentSession?.storyPovId
        ? [] : Array.isArray(rawStats) ? rawStats : (rawStats ? [rawStats] : []);

    const prota = isStoryMode && currentSession?.storyRole !== 'participant' && !currentSession?.storyPovId
        ? null : currentSession?.protagonist;
    const suggestions = currentSession?.plotSuggestions;

    const [pageIndex, setPageIndex] = useState(0);
    const dialog = useAppDialog();
    const [worldlineOpen, setWorldlineOpen] = useState(false);
    const [personaWorldFilter, setPersonaWorldFilter] = useState("all");
    useEffect(() => { setPersonaWorldFilter("all"); }, [currentSession?.memoryMode]);
    useEffect(() => { if (worldlineOpenSignal > 0) setWorldlineOpen(true); }, [worldlineOpenSignal]);

    useEffect(() => {
        if (pageIndex >= charList.length) setPageIndex(0);
    }, [charList.length]);

    const storyRole = currentSession?.storyRole === "participant" ? "participant" : "observer";
    const storyStarted = (currentSession?.messages || []).some((m: any) => m.role === "user");
    const possiblePovs = (currentSession?.sceneCastIds || []).flatMap((id: string) => {
        const char = (dbChars?.length ? dbChars : CHAR_DATA).find((item: any) => item.id === id);
        return char ? [char] : [];
    });
    const isEngineeringMode = currentSession?.memoryMode === "infinite";
    const isChatMode = currentSession?.memoryMode === "chat";
    const hasChatWorldline = isChatMode && !!currentSession?.storyWorldline;
    const roleLocked = isEngineeringCharacterLocked(currentSession);
    const worldNameFor = (worldId: string | null | undefined): string => !worldId ? deepText(locale, "sidebar.persona.worldNeutral")
        : worldId === "bang-dream" ? "BanG Dream!" : worlds.find((w: any) => w.id === worldId)?.name || deepText(locale, "sidebar.persona.unknownWorld");
    const charWorldId = (id: string): string | null =>
        customCharacters.find((char: any) => char.id === id)?.worldId || (CHAR_DATA.some(char => char.id === id) ? "bang-dream" : null);
    const personaCatalog = (dbChars?.length ? dbChars : CHAR_DATA) as Array<{ id: string; name: string; avatar: string; hex: string; sub: string }>;
    const personaWorldChoices = [...new Set(personaCatalog.map(char => charWorldId(char.id) || "universal"))];
    const filteredPersonas = !isChatMode
        ? personaCatalog.filter(char => !isEngineeringMode || personaWorldFilter === "all"
            || (charWorldId(char.id) || "universal") === personaWorldFilter)
        : !hasChatWorldline ? [] : personaCatalog.filter(char =>
            storyCastAllowed({ id: char.id, worldId: charWorldId(char.id) }, currentSession.storyWorldline));
    const { locale } = useLanguage();
    const currentChar = charList[pageIndex];

    const themeColor = currentChar ? (
        (dbChars?.length ? dbChars : CHAR_DATA).find((c: any) => {
            if (c.name === currentChar.name) return true;

            const keywords = c.keys || c.trigger_keys || [];
            return keywords.includes(currentChar.name);
        })?.hex
        || "#9ca3af"
    ) : "#9ca3af";

    const handleWorldlineUpdate = (next: StoryWorldline) => {
        if (!setSessions || !currentSessionId) return;
        if (!canExtendWorldline(currentSession?.storyWorldline, next)) return;
        const allowed = new Set([...CHAR_DATA, ...customCharacters].filter(char =>
            storyCastAllowed(char, next)).map(char => char.id));
        setSessions((prev: any) => prev.map((s: any) => {
            if (s.id !== currentSessionId) return s;
            const changed = s.storyWorldline?.worldId !== next.worldId;
            return { ...s, storyWorldline: next,
                storyNextCastIds: changed ? [] : (s.storyNextCastIds || []).filter((id: string) => allowed.has(id)),
                storyAllowCrossWorld: next.crossWorld?.enabled === true,
                ...(changed ? { sceneCastIds: [] } : {}),
            };
        }));
    };
    const handleCastSelection = (ids: string[], allowCrossWorld: boolean) => {
        if (!setSessions || !currentSessionId || isGenerating) return;
        setSessions((prev: any) => prev.map((s: any) =>
            s.id === currentSessionId ? { ...s, storyNextCastIds: ids, storyAllowCrossWorld: allowCrossWorld, updatedAt: Date.now() } : s
        ));
    };
    const viewpointColor = (dbChars?.length ? dbChars : CHAR_DATA).find((char: any) => char.id === currentSession?.storyPovId)?.hex || "#637e6e";

    // Keep DOM width stable on unrelated parent renders (e.g. music progress ticks).
    // Defining the bar here is safe now that it has no mount/replay animation.
    const StatBar = ({ label, value, color, max = 100, icon: Icon }: any) => {
        const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
        const width = Math.max(0, Math.min(100, amount / max * 100));
        return <div className="mb-2">
            <div className="mb-1 flex justify-between text-[10px] font-bold text-gray-600">
                <span className="flex items-center gap-1">{Icon && typeof Icon === "function" && <Icon size={10} />}{label}</span>
                <span className={amount >= 100 ? "text-red-500" : ""}>{amount >= 100 ? "MAX" : `${amount}/${max}`}</span>
            </div>
            <div className={`h-1.5 w-full overflow-hidden rounded-full ${amount >= 90 ? "bg-red-900/20" : "bg-gray-200"}`}>
                <div className="relative h-full" style={{ width: `${width}%`, backgroundColor: color }}>
                    <div className="absolute bottom-0 right-0 top-0 w-[2px] bg-white/50" />
                </div>
            </div>
        </div>;
    };

    const confirmSuggestion = async (text: string, mode: "send" | "insert") => {
        if (isGenerating || currentSession?.memoryMode !== "sliding" || !text.trim()) return;
        const accepted = await dialog.confirm(
            mode === "send" ? deepText(locale, "story.suggestion.sendAsk") : deepText(locale, "story.suggestion.insertAsk"),
            { title: mode === "send" ? deepText(locale, "story.suggestion.sendTitle") : deepText(locale, "story.suggestion.insertTitle"),
              confirmLabel: mode === "send" ? deepText(locale, "story.suggestion.sendConfirm") : deepText(locale, "story.suggestion.insertConfirm"), tone: "story", preview: text },
        );
        if (!accepted || isGenerating) return;
        if (mode === "send") { void handleSend(text); dialog.notify(deepText(locale, "story.suggestion.sent"), { tone: "story", type: "success" }); }
        else { setInput?.(text); dialog.notify(deepText(locale, "story.suggestion.inserted"), { tone: "story", type: "success" }); }
    };

    const SuggestionItem = ({ type, content, colorBg, colorText, colorBorder, icon }: any) => {
        const suggestion = String(content || "").trim();
        return (
            <div className={`group rounded border ${colorBg} ${colorBorder} ${colorText} text-xs transition-all hover:shadow-sm`}>
                <button type="button" disabled={!suggestion || isGenerating} onClick={() => void confirmSuggestion(suggestion, "send")}
                    className="block w-full rounded p-2.5 text-left transition-colors hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                    title={deepText(locale, "story.suggestion.viewAndSend")}>
                    <span className="mb-1.5 flex items-center gap-1 font-bold">{icon} {type}</span>
                    <span className="block leading-relaxed opacity-90">{suggestion}</span>
                </button>
                <div className="flex items-center justify-end gap-2 px-2.5 pb-2.5">
                    <button type="button" disabled={!suggestion || isGenerating}
                        onClick={() => void confirmSuggestion(suggestion, "insert")}
                        className="flex items-center gap-1 rounded-md border border-current/20 bg-white/60 px-2 py-1 text-[10px] font-medium hover:bg-white disabled:opacity-40"
                        title={deepText(locale, "story.suggestion.insertOnly")}><Send size={11} /> {deepText(locale, "story.suggestion.insert")}</button>
                </div>
            </div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="sidebar-right-panel"
                    initial={{ width: 0 }} animate={{ width: 280 }} exit={{ width: 0 }}
                    className="h-full bg-white flex flex-col shadow-xl z-30 border-l-0 overflow-hidden"
                >
                    <div className="p-3 flex justify-between items-center font-bold text-xs text-gray-500 border-b bg-gray-50/50  pt-[calc(0.75rem+env(safe-area-inset-top))]">
                        <span>{isStoryMode ? "VIA LATA · STORY" : currentSession?.memoryMode === "chat" ? "UMBRA · CHARACTERS" : "OFFICINA · CAST"}</span>
                        <button onClick={onClose}><ChevronRight size={16} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                        {isStoryMode ? (
                            <div className="p-3 space-y-4">
                                <div className="rounded-xl border border-[#e4e8e5] bg-[#fafcf9] p-3 space-y-3">
                                    <div className="text-[10px] font-bold tracking-widest text-[#6f8678]">{deepText(locale, "sidebar.story.role")} · STORY ROLE</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <button type="button" disabled={storyStarted} onClick={() => onStoryRoleChange("observer")} className={`rounded-lg border p-2 ${storyRole === "observer" ? "border-[#7d9c8a] bg-[#e8f0e9] text-[#365943]" : "border-[#dce6dd] text-[#77887c]"} disabled:opacity-70`}>{deepText(locale, "sidebar.story.observer")}</button>
                                        <button type="button" disabled={storyStarted || !activeStorySelf} onClick={() => onStoryRoleChange("participant")} title={!activeStorySelf ? deepText(locale, "sidebar.story.needSelf") : ""} className={`rounded-lg border p-2 ${storyRole === "participant" ? "border-[#7d9c8a] bg-[#e8f0e9] text-[#365943]" : "border-[#dce6dd] text-[#77887c]"} disabled:opacity-50`}>{deepText(locale, "sidebar.story.participant")}</button>
                                    </div>
                                    {storyRole === "participant" ? <p className="text-xs leading-5 text-[#75877b]">{deepText(locale, "sidebar.story.identity")}<span style={{ color: storySelf?.hex || "#799783" }}>{storySelf ? selfName(storySelf, locale) : deepText(locale, "sidebar.story.selfMissing")}</span></p>
                                    : <div className="space-y-2"><p className="text-[11px] leading-5 text-[#7d8e82]">{deepText(locale, "sidebar.story.observerHelp")}</p>
                                        {storyStarted && <label className="block text-xs text-[#718678]">{deepText(locale, "sidebar.story.pov")}<select value={currentSession?.storyPovId || ""} disabled={(currentSession?.storyPovLocked && Boolean(currentSession?.storyPovId)) || isGenerating} onChange={e => onStoryPovChange(e.target.value)} className="mt-1 w-full rounded-lg border border-[#dce6dd] bg-white p-2 text-xs disabled:opacity-60"><option value="">{deepText(locale, "sidebar.story.noPov")}</option>{possiblePovs.map((char: any) => <option key={char.id} value={char.id}>{characterDisplayName(char.id, char.name, locale)}</option>)}</select></label>}
                                        {currentSession?.storyPovLocked && currentSession?.storyPovId && <p className="flex items-center gap-1 text-[10px] text-[#a18c6f]"><Lock size={11}/>{deepText(locale, "sidebar.story.povLocked")}</p>}
                                    </div>}
                                </div>

                                <button type="button" onClick={() => setWorldlineOpen(true)} className="group relative w-full overflow-hidden rounded-2xl border border-[#dc7197]/55 bg-[#672b48] p-4 text-left shadow-[0_10px_25px_rgba(103,43,72,.16)] transition hover:border-[#f0b8cf] hover:shadow-lg">
                                    <span aria-hidden className="pointer-events-none absolute -right-7 -top-8 h-28 w-28 rounded-full border border-[#e2c996]/40" />
                                    <span aria-hidden className="pointer-events-none absolute right-0 top-1 h-16 w-16 rounded-full border border-[#e2c996]/20" />
                                    <div className="relative flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[11px] font-semibold tracking-[.15em] text-[#ffd1e3]" style={{fontFamily:'Bahnschrift,"Arial Narrow",sans-serif'}}>✧ WORLDLINE / {deepText(locale, "sidebar.story.worldline")}</span><span className="text-[10px] text-[#f1b9d2] group-hover:text-white">{deepText(locale, "sidebar.story.openWorld")}</span></div>
                                    <p className="relative mt-2 text-[11px] leading-5 text-[#ffe4ed]">{currentSession?.storyWorldline ? describeStoryWorldline(currentSession.storyWorldline, locale) : currentSession?.timeline?.major ? `${deepText(locale, "sidebar.story.legacy")}${currentSession.timeline.major} / ${currentSession.timeline.medium || deepText(locale, "sidebar.story.notSet")}` : deepText(locale, "sidebar.story.worldMissing")}</p>
                                </button>
                                {currentSession && <StoryCastPicker key={currentSession.id} session={currentSession}
                                    worlds={worlds} customCharacters={customCharacters} busy={isGenerating}
                                    onApply={handleCastSelection} />}

                                {prota && (
                                    <div className="rounded-lg border shadow-sm relative overflow-hidden" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#E0E0FF]/30 rounded-bl-full -mr-4 -mt-4"></div>
                                        <div className="p-3 relative z-10">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider flex items-center gap-1"><User size={10} /> {deepText(locale, "sidebar.story.selfStatus")}</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs leading-5">
                                                <div className="col-span-2 text-gray-500">Name: <span className="font-bold" style={{ color: storyRole === "participant" ? storySelf?.hex || "#799783" : viewpointColor }}>{storyRole === "participant" && storySelf ? selfName(storySelf, locale) : prota.name || deepText(locale, "sidebar.story.unnamed")}</span></div>
                                                <div className="col-span-2 text-gray-500">Time: <span className="text-gray-800">{prota.timeDesc || "—"}</span></div>
                                                <div className="col-span-2 text-gray-500">Env: <span className="text-gray-800">{prota.environment || "—"}</span></div>
                                                <div className="col-span-2 text-gray-500">Outfit: <span className="text-gray-800">{prota.clothing || "—"}</span></div>
                                                <div className="col-span-2 flex items-start gap-1 text-gray-500"><Thermometer size={11} className="mt-0.5 shrink-0"/><span>{prota.temperature || "—"} · {prota.sensation || "—"}</span></div>
                                                <div className="col-span-2 border-t border-slate-200 pt-2 text-[11px] italic text-gray-700">{prota.innerState && prota.innerState !== "—" ? `“${prota.innerState}”` : deepText(locale, "sidebar.story.innerMissing")}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentChar && (
                                    <div className="rounded-lg border shadow-sm transition-colors duration-500" style={{ backgroundColor: `${themeColor}10`, borderColor: `${themeColor}40` }}>
                                        <div className="p-3">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: themeColor }}><Heart size={10} /> {deepText(locale, "sidebar.story.target")}: {characterDisplayName((dbChars?.length ? dbChars : CHAR_DATA).find((c: any) => c.name === currentChar.name)?.id, currentChar.name, locale)}</div>
                                                {charList.length > 1 && (
                                                    <div className="flex gap-1">
                                                        <button onClick={() => setPageIndex(p => p > 0 ? p - 1 : charList.length - 1)} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft size={10} /></button>
                                                        <span className="text-[9px] text-gray-400 self-center">{pageIndex + 1}/{charList.length}</span>
                                                        <button onClick={() => setPageIndex(p => p < charList.length - 1 ? p + 1 : 0)} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight size={10} /></button>
                                                    </div>
                                                )}
                                            </div>

                                            <StatBar label={deepText(locale, "sidebar.story.affection")} value={currentChar.affection} color={themeColor} icon={Heart} />
                                            <StatBar label={deepText(locale, "sidebar.story.possessiveness")} value={currentChar.Possessiveness} color="#9333ea" icon={Zap} />
                                            <StatBar label={deepText(locale, "sidebar.story.obsession")} value={currentChar.Obsession} color="#dc2626" icon={Skull} />
                                            <StatBar label={deepText(locale, "sidebar.story.lust")} value={currentChar.Lust ?? currentChar.Intimacy ?? 0} color="#fb7185" icon={Sparkles} />

                                            <div className="mt-3 text-[10px] space-y-2 text-gray-600 border-t pt-2" style={{ borderColor: `${themeColor}30` }}>
                                                {currentChar.innerState && (
                                                    <div className="bg-white/60 p-2 rounded border border-black/5 italic relative">
                                                        <span className="absolute -top-2 left-1 bg-white px-1 text-[9px] text-gray-400 font-bold not-italic">💭 {deepText(locale, "sidebar.story.inner")}</span>
                                                        "{currentChar.innerState}"
                                                    </div>
                                                )}
                                                <div><div className="font-bold text-gray-400 flex items-center gap-1 mb-0.5"><Shirt size={10} /> {deepText(locale, "sidebar.story.clothing")}:</div><div className="leading-relaxed pl-1">{currentChar.clothing}</div></div>
                                                <div><div className="font-bold text-gray-400 flex items-center gap-1 mb-0.5"><Footprints size={10} /> {deepText(locale, "sidebar.story.legs")}:</div><div className="leading-relaxed pl-1">{currentChar.shoes} {currentChar.legState}</div></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {suggestions && (
                                    <div className="space-y-3 pb-4">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Sparkles size={10} /> {deepText(locale, storyRole === "observer" ? "sidebar.story.observerDirection" : "sidebar.story.plotDirection")}</div>
                                        <SuggestionItem type={deepText(locale, "sidebar.story.fun")} content={suggestions.fun} colorBg="bg-yellow-50" colorBorder="border-yellow-200" colorText="text-yellow-800" icon="🤪" />
                                        <SuggestionItem type={deepText(locale, "sidebar.story.rational")} content={suggestions.rational} colorBg="bg-blue-50" colorBorder="border-blue-200" colorText="text-blue-800" icon="🧠" />
                                        <SuggestionItem type={deepText(locale, "sidebar.story.radical")} content={suggestions.radical} colorBg="bg-red-50" colorBorder="border-red-200" colorText="text-red-800" icon="🔥" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-2 space-y-4">
                                <div className="space-y-2">
                                    {isEngineeringMode && <label className="block rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] font-semibold text-slate-600">
                                        <span className="mb-2 block">{deepText(locale, "sidebar.persona.worldFilter")}</span>
                                        <select value={personaWorldFilter} onChange={e => setPersonaWorldFilter(e.target.value)}
                                            className="w-full rounded-lg border border-[#e0e7e9] bg-white px-3 py-2 text-xs text-[#314c63] outline-none focus:border-[#9cacaa]">
                                            <option value="all">{deepText(locale, "sidebar.persona.allWorlds")}</option>
                                            {personaWorldChoices.map(worldId => <option key={worldId} value={worldId}>
                                                {worldNameFor(worldId === "universal" ? null : worldId)}
                                            </option>)}
                                        </select>
                                    </label>}
                                    {isChatMode && !hasChatWorldline && <div className="rounded-xl border border-dashed border-[#cadad0] bg-[#f7faf8] px-4 py-5 text-center text-xs leading-6 text-[#728f80]">
                                        <TreeDeciduous size={20} className="mx-auto mb-2"/>
                                        {deepText(locale, "sidebar.umbra.worldHelp")}<br/>{deepText(locale, "sidebar.umbra.characterHelp")}
                                    </div>}
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">{currentSession?.memoryMode === 'chat' ? 'Umbra · Characters' : 'Officina · Persona'}</div>
                                    {isEngineeringMode && <p className="px-1 text-[11px] leading-5 text-slate-500">{roleLocked ? deepText(locale, "sidebar.persona.lockedHelp") : deepText(locale, "sidebar.persona.selectHelp")}</p>}
                                    {filteredPersonas.map((char: any, index: number) => (
                                        <div
                                            key={char.id || index}
                                            onClick={() => {
                                                if ((isEngineeringMode && roleLocked) || isGenerating || activeCharacterId === char.id) return;
                                                onCharSwitch(char.id);
                                            }}
                                            title={isEngineeringMode && roleLocked && activeCharacterId !== char.id ? deepText(locale, "sidebar.persona.locked") : undefined}
                                            aria-disabled={isEngineeringMode && roleLocked && activeCharacterId !== char.id}
                                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all border relative overflow-hidden group ${isEngineeringMode && roleLocked && activeCharacterId !== char.id ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                                            style={{
                                                backgroundColor: activeCharacterId === char.id ? char.hex : `${char.hex}08`,
                                                borderColor: activeCharacterId === char.id ? char.hex : 'transparent',
                                                color: activeCharacterId === char.id ? 'white' : '#374151'
                                            }}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-lg shadow-sm z-10 flex-shrink-0">
                                                {char.avatar}
                                            </div>

                                            <div className="text-left z-10 flex-1 min-w-0">
                                                <div className="text-xs font-bold truncate">{characterDisplayName(char.id, char.name, locale)}</div>
                                                <div className={`text-[9px] truncate ${activeCharacterId === char.id ? 'text-white/80' : 'text-gray-400'}`}>
                                                    {isEngineeringMode || isChatMode ? worldNameFor(charWorldId(char.id)) : char.sub}
                                                </div>
                                            </div>


                                            {isEngineeringMode && roleLocked && activeCharacterId === char.id && <span className="relative z-10 flex shrink-0 items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-[10px] font-semibold" title={deepText(locale, "sidebar.persona.boundTitle")}>
                                                <Lock size={12} /> {deepText(locale, "sidebar.persona.bound")}
                                            </span>}
                                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        )}
                    </div>

                    <StoryWorldlineFateModal tone={isStoryMode ? "story" : isChatMode ? "chat" : "story"} isOpen={worldlineOpen} value={currentSession?.storyWorldline}
                        legacyTimeline={currentSession?.timeline} worlds={worlds}
                        onSave={handleWorldlineUpdate} onClose={() => setWorldlineOpen(false)}
                        onOpenCharta={onOpenChartaWorld ? () => { setWorldlineOpen(false); onOpenChartaWorld(); } : undefined}/>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
export const SidebarRight = React.memo(SidebarRightComponent);