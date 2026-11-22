"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    PanelLeftClose, Package, ChevronDown, ChevronRight,
    FolderPlus, Plus, Search, Folder, Trash2, Download, Upload,
    Globe, Image as ImageIcon,
    ListChecks, CheckSquare, Square, Disc,
    BookMarked, BookOpen, MessageCircle, Code2,
    HardDrive, AlertTriangle, Mic,
    RefreshCw, Check, X
} from "lucide-react";
import { fallbackModelGroups, type LocalModelGroup, type PublicLocalProvider } from "../lib/localProviders";
import { useSavedModels } from "../hooks/useSavedModels";
import { useLanguage } from "../context/LanguageContext";
import { useAppDialog } from "../context/DialogContext";
import { localText } from "../lib/i18nLocal";
import { SessionItem } from "./Common";
import { deepText } from "../lib/i18nDeep";
import { browserIde } from "../lib/browserIde";
import { BatchDeleteModal } from "./BatchDeleteModal";
import { StoryWorldlineFateModal } from "./StoryWorldlineFateModal";
import { describeStoryWorldline, type StoryWorldline } from "../lib/storyWorldline";

export const SidebarLeft = ({
    isOpen, onClose,
    expandedGroups, setExpandedGroups,
    selectedModel, setSelectedModel,
    customModelId, setCustomModelId,
    folders, setFolders,
    sessions, currentSessionId, setCurrentSessionId,
    createFolder, toggleFolder, deleteFolder,
    createNewSession, deleteSession,
    searchQuery, setSearchQuery,
    editingSessionId, setEditingSessionId,
    tempTitle, setTempTitle,
    activeMenuSessionId, setActiveMenuSessionId,
    updateSessionTitle, moveSessionToFolder, onBindEngineeringProject,
    handleExportData, handleImportData,
    useWebSearch, toggleWebSearch,
    useImageGen, toggleImageGen,
    batchDelete,
    useMusicControl,
    toggleMusicControl,
    triggerEffect,
    useTTS, toggleTTS,
    syncStatus, onManualSync,
    apiProvider, setApiProvider, providers = [],
    currentMode, chatWorldline, onSaveChatWorldline, chatWorldlineOpenSignal = 0, storyWorlds = [],
}: any) => {
    const { locale } = useLanguage();
    const dialog = useAppDialog();
    const importInputRef = useRef<HTMLInputElement>(null);

    const [showNewChatMenu, setShowNewChatMenu] = useState(false);
    const [chatWorldlineOpen, setChatWorldlineOpen] = useState(false);
    useEffect(() => {
        if (chatWorldlineOpenSignal > 0 && currentMode === "chat") setChatWorldlineOpen(true);
    }, [chatWorldlineOpenSignal]);
    const showSession = (session: any) => session.memoryMode !== 'lime';
    // Group sessions by their current folder, but order BOTH folder groups
    // and unfiled conversations by the latest activity of their members.
    // This keeps files organised while bringing active work to the top.
    const visibleSessions = (sessions as any[])
        .filter(session => showSession(session) && session.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => (Number(b.updatedAt) || Number(b.id) || 0) - (Number(a.updatedAt) || Number(a.id) || 0));
    const knownFolders = new Set((folders as any[]).map(folder => folder.id));
    const explorerEntries: Array<{ kind: "folder" | "session"; item: any; latest: number; tie: number }> = [
        ...(folders as any[]).map((folder, index) => ({
            kind: "folder" as const, item: folder,
            latest: Math.max(0, ...visibleSessions.filter(session => session.folderId === folder.id)
                .map(session => Number(session.updatedAt) || Number(session.id) || 0)),
            tie: index,
        })),
        ...visibleSessions.filter(session => !session.folderId || !knownFolders.has(session.folderId))
            .map((session, index) => ({
                kind: "session" as const, item: session,
                latest: Number(session.updatedAt) || Number(session.id) || 0,
                tie: (folders as any[]).length + index,
            })),
    ].filter(entry => !searchQuery || entry.kind === "session"
        || visibleSessions.some(session => session.folderId === entry.item.id))
      .sort((a, b) => b.latest - a.latest || a.tie - b.tie);

    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBatchConfirm, setShowBatchConfirm] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [bindingSessionId, setBindingSessionId] = useState<string | null>(null);
    const [ideProjects, setIdeProjects] = useState<string[]>([]);
    const [projectLoading, setProjectLoading] = useState(false);
    const loadBindingProjects = async (sessionId: string) => {
        setActiveMenuSessionId(null);
        setBindingSessionId(sessionId);
        setProjectLoading(true);
        try {
            const data = await browserIde("projects");
            setIdeProjects(Array.isArray(data.projects) ? data.projects : []);
        } catch (e: any) { dialog.notify(e.message); }
        finally { setProjectLoading(false); }
    };
    const createBindingProject = async () => {
        const name = await dialog.prompt(deepText(locale, "sidebar.left.newRoot"));
        if (!name) return;
        try {
            const data = await browserIde("createProject", {name});
            setIdeProjects(prev => [...new Set([...prev, data.project])].sort());
            if (bindingSessionId) onBindEngineeringProject(bindingSessionId, data.project);
            setBindingSessionId(null);
        } catch (e: any) { dialog.notify(e.message); }
    };
    const [modelGroups, setModelGroups] = useState<LocalModelGroup[]>([]);
    const hasUsableProvider = (providers as PublicLocalProvider[]).some(p => p.configured && p.id === apiProvider);
    const [catalogSource, setCatalogSource] = useState("fallback");
    const { savedModels, saveModel, forgetModel } = useSavedModels();
    const saveCustomModel = () => saveModel(apiProvider, String(customModelId || ""));
    const forgetCustomModel = (id: string) => forgetModel(apiProvider, id);
    useEffect(() => {
        let active = true;
        setModelGroups(hasUsableProvider && !apiProvider.startsWith("custom_") ? fallbackModelGroups(apiProvider) : []);
        setCatalogSource("fallback");
        if (!hasUsableProvider || apiProvider.startsWith("custom_")) return;
        fetch(`/api/providers?models=${encodeURIComponent(apiProvider)}`)
            .then(async (res) => { if (!res.ok) throw new Error("Catalog unavailable"); return res.json(); })
            .then((data) => { if (active && Array.isArray(data.groups)) { setModelGroups(data.groups); setCatalogSource(data.source || "fallback"); } })
            .catch(() => { /* Offline fallback remains visible. */ });
        return () => { active = false; };
    }, [apiProvider, hasUsableProvider]);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 300, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="h-full bg-white flex flex-col shadow-xl z-40 border-r border-gray-200 md:border-r-0 fixed inset-y-0 left-0 md:relative overflow-hidden"
                >
                    <div className="p-3 flex items-center justify-between pt-[calc(0.75rem+env(safe-area-inset-top))]">
                        <div className="flex items-center gap-2 font-bold text-gray-800">
                            <img src="/shiorivia-app-icon.png" alt="" width={24} height={24} className="h-6 w-6 rounded-md" />
                            <span className="text-xs uppercase tracking-widest">Shiorivia</span>
                        </div>
                        <button onClick={onClose} className="rounded-lg bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700" title={deepText(locale, "sidebar.left.collapse")} aria-label={deepText(locale, "sidebar.left.collapse")}><PanelLeftClose size={15} /></button>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            {currentMode === "chat" && <div className="shrink-0 border-b border-[#e4e9e5] bg-white px-3 pb-3 pt-2">
                                <button type="button" onClick={() => setChatWorldlineOpen(true)}
                                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#dae6df] bg-[#f8faf8] px-3 py-3 text-left transition hover:border-[#9eb8a9]">
                                    <span className="min-w-0"><span className="block text-[10px] font-semibold tracking-widest text-[#537566]">UMBRA · WORLDLINE</span>
                                        <span className="mt-1 block truncate text-xs text-[#486453]">{chatWorldline ? describeStoryWorldline(chatWorldline, locale) : deepText(locale, "sidebar.left.umbraMissing")}</span>
                                    </span><Globe size={17} className="shrink-0 text-[#6a9680]"/>
                                </button>
                                <StoryWorldlineFateModal tone="chat" isOpen={chatWorldlineOpen} value={chatWorldline}
                                    worlds={storyWorlds} showEvent={false} onSave={(next: StoryWorldline) => onSaveChatWorldline(next)}
                                    onClose={() => setChatWorldlineOpen(false)} />
                            </div>}
                            <div className="h-[42%] min-h-[160px] shrink-0 overflow-y-auto border-b border-slate-200 bg-white p-3 scrollbar-thin">
                                <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span>{deepText(locale, "sidebar.left.models")}</span><Package size={13} /></div>

                                <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-[#edf0ef] bg-[#fafbfb] p-1 text-xs font-bold">
                                    {(providers as PublicLocalProvider[]).map((p) => (
                                        <button key={p.id} type="button" onClick={() => setApiProvider(p.id)}
                                            className={`truncate rounded px-2 py-1.5 transition-all ${apiProvider === p.id ? 'bg-white text-slate-800 shadow' : 'text-gray-500 hover:text-gray-800'}`} title={p.label}>
                                            {p.label}
                                        </button>
                                    ))}
                                    {providers.length === 0 && <p className="col-span-2 px-2 py-2 text-[11px] text-amber-600">{deepText(locale, "explorer.noKey")}</p>}
                                </div>
                                {hasUsableProvider && !apiProvider.startsWith("custom_") && <p className="mb-2 text-[10px] text-slate-400">{catalogSource === "live" ? deepText(locale, "sidebar.left.liveModels") : deepText(locale, "sidebar.left.offlineModels")}</p>}

                                {hasUsableProvider && !apiProvider.startsWith("custom_") && modelGroups.map((g: any) => (
                                    <div key={g.groupName} className="mb-1">
                                        <button onClick={() => setExpandedGroups((prev: any) => prev.includes(g.groupName) ? prev.filter((x: any) => x !== g.groupName) : [...prev, g.groupName])} className="w-full flex justify-between p-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded">
                                            <span>{g.groupName}</span>
                                            {expandedGroups.includes(g.groupName) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </button>
                                        {expandedGroups.includes(g.groupName) && (
                                            <div className="pl-2 border-l border-gray-100 ml-1">
                                                {g.models.map((m: any) => (
                                                    <button key={m.id} onClick={() => { setSelectedModel(m.id); setCustomModelId("") }} className={`block w-full text-left text-[11px] py-1 truncate ${selectedModel === m.id && !customModelId ? 'text-slate-800 font-bold' : 'text-gray-400 hover:text-gray-900'}`}>
                                                        {m.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {hasUsableProvider && apiProvider.startsWith("custom_") && <p className="mb-2 text-[11px] leading-5 text-[#70818c]">{deepText(locale, "sidebar.left.customProviderHelp")}</p>}
                                {hasUsableProvider && <div className="mt-3 border-t border-[#e7ebee] pt-3">
                                    <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500"><span className="font-semibold tracking-wide">{deepText(locale, "sidebar.left.customModel")}</span><span>{deepText(locale, "sidebar.left.currentProvider")}</span></div>
                                    <div className="flex gap-1.5">
                                        <input aria-label={deepText(locale, "sidebar.left.modelId")} value={customModelId} onChange={(e: any) => setCustomModelId(e.target.value)} placeholder={deepText(locale, "sidebar.left.modelPlaceholder")} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-slate-400" />
                                        <button type="button" onClick={saveCustomModel} disabled={!apiProvider || !String(customModelId || "").trim() || String(customModelId).length > 200 || (savedModels[apiProvider] || []).includes(String(customModelId).trim())}
                                            className="shrink-0 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-40">{deepText(locale, "common.save")}</button>
                                    </div>
                                    {(savedModels[apiProvider] || []).length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {(savedModels[apiProvider] || []).map(id => (
                                                <div key={id} className={`flex items-center gap-1 rounded-lg px-1.5 py-1 ${customModelId === id ? 'bg-slate-100' : 'hover:bg-white'}`}>
                                                    <button type="button" onClick={() => setCustomModelId(id)} title={id} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] text-slate-600">
                                                        <span className="min-w-0 flex-1 truncate">{id}</span>
                                                        <span className="shrink-0 rounded border border-slate-200 px-1 py-0.5 text-[9px] text-slate-500">{deepText(locale, "sidebar.left.custom")}</span>
                                                    </button>
                                                    <button type="button" onClick={() => forgetCustomModel(id)} title={`${deepText(locale, "sidebar.left.removeSaved")} ${id}`} aria-label={`${deepText(locale, "sidebar.left.removeSaved")} ${id}`} className="rounded p-1 text-[#b5bdb7] hover:bg-[#f9e9e5] hover:text-[#aa6857]"><X size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>}
                            </div>
                            <div className="flex-1 flex flex-col min-h-0 bg-white p-2">
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Explorer · {deepText(locale, "explorer.title")}</span>
                                    <div className="flex gap-1">
                                        <button onClick={createFolder} className="p-1 hover:bg-gray-50 rounded text-gray-400" title={deepText(locale, "explorer.newFolder")}><FolderPlus size={14} /></button>
                                        <button onClick={() => { setIsBatchMode(!isBatchMode); setSelectedIds(new Set()); }} className={`p-1 rounded transition-colors ${isBatchMode ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-gray-400 hover:bg-gray-50'}`} title={deepText(locale, "explorer.batch")}><ListChecks size={14} /></button>
                                        <div className="relative">
                                            <button onClick={() => setShowNewChatMenu(!showNewChatMenu)} title={deepText(locale, "explorer.new")} className="p-1 hover:bg-emerald-50 rounded text-slate-800 flex items-center gap-0.5"><Plus size={14} /><ChevronDown size={10} /></button>
                                            <AnimatePresence>
                                                {showNewChatMenu && (
                                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
                                                        <button onClick={() => { createNewSession(undefined, 'sliding'); setShowNewChatMenu(false) }} className="w-full text-left px-3 py-2 text-xs hover:bg-rose-50 text-gray-700 flex items-center gap-2"><BookOpen size={13} className="shrink-0 text-[#c07c98]" /> Via Lata</button>
                                                        <button onClick={() => { createNewSession(undefined, 'infinite'); setShowNewChatMenu(false) }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-gray-700 flex items-center gap-2"><Code2 size={13} className="shrink-0 text-[#607d9b]" /> Officina</button>
                                                        <button onClick={() => { createNewSession(undefined, 'chat'); setShowNewChatMenu(false) }} className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 text-gray-700 flex items-center gap-2"><MessageCircle size={13} className="shrink-0 text-[#70987f]" /> Umbra</button>
                                                        <button onClick={() => { createNewSession(undefined, 'novel'); setShowNewChatMenu(false) }} className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 text-gray-700 flex items-center gap-2"><BookMarked size={13} className="shrink-0 text-[#b49760]" /> Tela</button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative mb-2"><Search size={12} className="absolute left-2 top-2 text-gray-400" /><input className="w-full bg-gray-50 border rounded-lg py-1 pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-gray-200" placeholder={deepText(locale, "sidebar.left.search")} value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} /></div>

                                <div className="flex-1 overflow-y-auto scrollbar-thin">
                                    {explorerEntries.map(entry => entry.kind === "folder" ? (
                                        <div key={`folder-${entry.item.id}`} className="mb-1">
                                            <div className="group flex cursor-pointer items-center justify-between rounded px-2 py-1 hover:bg-gray-50" onClick={() => toggleFolder(entry.item.id)}>
                                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                                                    <Folder size={12} className="fill-yellow-400 text-yellow-400"/>
                                                    {entry.item.name}
                                                </div>
                                                <button type="button" aria-label={`${deepText(locale, "sidebar.left.deleteFolder")} ${entry.item.name}`} onClick={(event) => deleteFolder(event, entry.item.id)}
                                                    className="rounded p-1 text-gray-400 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"><Trash2 size={12}/></button>
                                            </div>
                                            {entry.item.isExpanded && (
                                                <div className="ml-3 border-l border-gray-100 pl-2">
                                                    {visibleSessions.filter(session => session.folderId === entry.item.id).map(session => (
                                                        <div key={session.id} className="mb-0.5 flex items-center gap-1">
                                                            {isBatchMode && <button type="button" onClick={() => toggleSelect(session.id)} className="p-1">
                                                                {selectedIds.has(session.id) ? <CheckSquare size={16} className="text-indigo-500"/> : <Square size={16} className="text-gray-300"/>}
                                                            </button>}
                                                            <div className="min-w-0 flex-1">
                                                                <SessionItem session={session} isActive={currentSessionId === session.id} isEditing={editingSessionId === session.id} tempTitle={tempTitle} showMenu={activeMenuSessionId === session.id} folders={folders} onSelect={() => setCurrentSessionId(session.id)} onEditStart={() => { setEditingSessionId(session.id); setTempTitle(session.title); setActiveMenuSessionId(null); }} onEditSave={() => updateSessionTitle(session.id, tempTitle)} onDelete={(event: any) => deleteSession(event, session.id)} onMenuToggle={(event: any) => { event.stopPropagation(); setActiveMenuSessionId(activeMenuSessionId === session.id ? null : session.id); }} onMoveTo={(fid: any) => moveSessionToFolder(session.id, fid)} onBindProject={loadBindingProjects} setTempTitle={setTempTitle}/>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div key={`session-${entry.item.id}`} className="mb-0.5 flex items-center gap-1">
                                            {isBatchMode && <button type="button" onClick={() => toggleSelect(entry.item.id)} className="p-1">
                                                {selectedIds.has(entry.item.id) ? <CheckSquare size={16} className="text-indigo-500"/> : <Square size={16} className="text-gray-300"/>}
                                            </button>}
                                            <div className="min-w-0 flex-1">
                                                <SessionItem session={entry.item} isActive={currentSessionId === entry.item.id} isEditing={editingSessionId === entry.item.id} tempTitle={tempTitle} showMenu={activeMenuSessionId === entry.item.id} folders={folders} onSelect={() => setCurrentSessionId(entry.item.id)} onEditStart={() => { setEditingSessionId(entry.item.id); setTempTitle(entry.item.title); setActiveMenuSessionId(null); }} onEditSave={() => updateSessionTitle(entry.item.id, tempTitle)} onDelete={(event: any) => deleteSession(event, entry.item.id)} onMenuToggle={(event: any) => { event.stopPropagation(); setActiveMenuSessionId(activeMenuSessionId === entry.item.id ? null : entry.item.id); }} onMoveTo={(fid: any) => moveSessionToFolder(entry.item.id, fid)} onBindProject={loadBindingProjects} setTempTitle={setTempTitle}/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                    </div>


                    {bindingSessionId && <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/35 p-4" onClick={() => setBindingSessionId(null)}>
                        <div role="dialog" aria-modal="true" aria-label={deepText(locale, "sidebar.left.bindAria")}
                            className="w-full max-w-sm rounded-2xl border border-[#d8deea] bg-white p-5 shadow-2xl"
                            onClick={e => e.stopPropagation()}>
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-sm font-semibold text-[#465675]">{deepText(locale, "sidebar.left.bindTitle")}</span>
                                <button type="button" onClick={() => setBindingSessionId(null)} className="rounded-lg p-1.5 hover:bg-slate-100"><X size={16}/></button>
                            </div>
                            <p className="mb-3 text-xs leading-5 text-slate-500">{deepText(locale, "sidebar.left.bindHelp")}</p>
                            <div className="max-h-60 space-y-1 overflow-y-auto">
                                {projectLoading ? <div className="p-3 text-xs text-slate-400">{deepText(locale, "sidebar.left.loadingProjects")}</div>
                                    : ideProjects.length ? ideProjects.map(project => (
                                        <button key={project} type="button" onClick={() => {
                                            onBindEngineeringProject(bindingSessionId, project);
                                            setBindingSessionId(null);
                                        }} className="flex w-full items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50">
                                            <Folder size={14} className="text-indigo-400"/> {project}
                                        </button>
                                    )) : <p className="p-3 text-xs text-slate-400">{deepText(locale, "sidebar.left.noProjects")}</p>}
                            </div>
                            <button type="button" onClick={createBindingProject}
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                                <FolderPlus size={14}/> {deepText(locale, "sidebar.left.newAndBind")}
                            </button>
                        </div>
                    </div>}
                    <div className="p-3">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                                <HardDrive size={10} /> Local Sync
                            </span>

                            <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity">
                                <button onClick={handleExportData} className="p-1 hover:bg-gray-200 rounded text-gray-500" title={deepText(locale, "explorer.export")}>
                                    <Download size={12} />
                                </button>
                                <button onClick={() => importInputRef.current?.click()} className="p-1 hover:bg-gray-200 rounded text-gray-500" title={deepText(locale, "explorer.import")}>
                                    <Upload size={12} />
                                </button>
                                <input type="file" ref={importInputRef} onChange={handleImportData} className="hidden" accept=".json" />
                            </div>
                        </div>

                        <button
                            onClick={onManualSync}
                            disabled={syncStatus === 'syncing'}
                            className={`
                            w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm
                                ${syncStatus === 'syncing'
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-500 cursor-wait'
                                    : syncStatus === 'error'
                                        ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                                        : syncStatus === 'success'
                                            ? 'bg-emerald-50 border-emerald-200 text-slate-800'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md active:scale-[0.98]'
                                }
                            `}
                        >
                            {syncStatus === 'syncing' ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>{localText(locale, "sync.syncing")}</span>
                                </>
                            ) : syncStatus === 'error' ? (
                                <>
                                    <AlertTriangle size={14} />
                                    <span>{localText(locale, "sync.failed")}</span>
                                </>
                            ) : syncStatus === 'success' ? (
                                <>
                                    <Check size={14} />
                                    <span>{localText(locale, "sync.saved")}</span>
                                </>
                            ) : (
                                <>
                                    <HardDrive size={14} />
                                    <span>{localText(locale, "sync.now")}</span>
                                </>
                            )}
                        </button>

                        <div className="text-[9px] text-center mt-1.5 text-gray-300 font-mono">
                            {syncStatus === "idle" ? localText(locale, "sync.auto") : syncStatus === "success" ? localText(locale, "sync.success") : syncStatus === "unsaved" ? localText(locale, "sync.pending") : syncStatus === "error" ? localText(locale, "sync.check") : localText(locale, "sync.syncing")}
                        </div>
                    </div>

                    <AnimatePresence>
                        {isBatchMode && (
                            <motion.div
                                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                                className="absolute bottom-16 left-4 right-4 bg-white border border-indigo-200 shadow-2xl rounded-xl p-3 z-50 flex items-center justify-between"
                            >
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Selected</span>
                                    <span className="text-lg font-black text-indigo-600 leading-tight">{selectedIds.size}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setIsBatchMode(false); setSelectedIds(new Set()); }} className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:bg-gray-100 rounded-lg">CANCEL</button>
                                    <button onClick={() => setShowBatchConfirm(true)} disabled={selectedIds.size === 0} className="px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg shadow-md disabled:opacity-50">DELETE</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <BatchDeleteModal
                        isOpen={showBatchConfirm}
                        onClose={() => setShowBatchConfirm(false)}
                        count={selectedIds.size}
                        onConfirm={() => {
                            batchDelete(Array.from(selectedIds));
                            setIsBatchMode(false);
                            setSelectedIds(new Set());
                        }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};