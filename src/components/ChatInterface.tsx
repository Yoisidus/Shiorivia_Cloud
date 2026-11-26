"use client";
import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send, Paperclip, Menu, House, BookOpen, Users, StickyNote,
    RotateCcw, Check, Square, Pencil, Trash2, RefreshCw, Copy, Cpu, FileText,
    Volume2, Loader2, Sparkles, Moon, Brain,
    Save, Terminal, ClipboardList, Guitar, Image as ImageIcon, Shirt,
    Disc, ChevronUp, MoreHorizontal, Settings, Route, Hammer, TreeDeciduous, FileCheck2,
    ToggleLeft, ToggleRight, Skull, Binary, CloudRain, AlertTriangle
} from "lucide-react";
import { ThinkingBlock } from "./Common";
import { buildDrawRequest } from "../lib/drawRequest";
import { CHARACTERS } from "../types";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import type { Locale } from "../lib/locale";
import { useAppDialog } from "../context/DialogContext";
import { characterDisplayName } from "../lib/characterNames";
import { parseStoryWorldline } from "../lib/storyWorldline";
import { MiniPlayer } from "./MiniPlayer";
import { MusicPlayerModal } from "./MusicPlayerModalV2";
import { useMusic } from "../context/MusicContext"; 
import ReactMarkdown from "react-markdown";
import { smartColorize } from "../lib/textFormatter";
import { formatOfficinaStreamingDisplay } from "../lib/engineeringDisplay";
import { cleanDrawTag } from "../lib/parseDraw";
import { IllustratedImage, ImageLightbox } from "./IllustrationImage";

const DrawPlaceholder = ({ onGenerate, busy, disabled, mode, locale }: {
    onGenerate: () => void; busy: boolean; disabled: boolean; mode: "infinite" | "sliding" | "chat"; locale: import("../lib/locale").Locale;
}) => {
    const styles = {
        infinite: {
            frame: "border-[#b9d5ed] bg-[#f0f7ff] hover:border-[#76acd5] hover:bg-[#e5f2ff]",
            icon: "bg-[#dcecff] text-[#3971a3]",
            title: "text-[#355f8a]", helper: "text-[#6f94b7]",
            label: "OFFICINA · VISUAL WORKSPACE", text: deepText(locale, "chat.drawOfficina"),
        },
        sliding: {
            frame: "border-[#e9c3d5] bg-[#fff4fa] hover:border-[#ce8eaf] hover:bg-[#ffedf5]",
            icon: "bg-[#fce0ef] text-[#b15f89]",
            title: "text-[#905375]", helper: "text-[#b87f9b]",
            label: "VIA LATA · SCENE ILLUSTRATION", text: deepText(locale, "chat.drawStory"),
        },
        chat: {
            frame: "border-[#c0e0cd] bg-[#f1fbf6] hover:border-[#8bbfa2] hover:bg-[#e7f7ee]",
            icon: "bg-[#d9f0e2] text-[#4c936f]",
            title: "text-[#446f59]", helper: "text-[#709f83]",
            label: "UMBRA · MOMENT CAPTURE", text: deepText(locale, "chat.drawUmbra"),
        },
    }[mode];
    return (
        <button type="button" disabled={disabled} onClick={onGenerate}
            className={`group/draw my-2 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${styles.frame}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}><ImageIcon size={18}/></span>
            <span className="min-w-0 flex-1">
                <span className={`block text-[9px] font-bold tracking-[0.13em] ${styles.helper}`}>{styles.label}</span>
                <span className={`mt-1 block text-xs font-semibold ${styles.title}`}>{styles.text}</span>
            </span>
            <span className={`shrink-0 text-[11px] font-medium ${styles.helper}`}>{busy ? deepText(locale, "chat.drawWorking") : deepText(locale, "chat.drawClick")}</span>
        </button>
    );
};

const renderContent = (text: string, onOpenImage: (src: string) => void, locale: Locale, selfColors: Record<string, string> = {}) => {
    if (!text) return null;
    let workingText = cleanDrawTag(text);

    try {
        const galleryMatch = workingText.match(/\[GALLERY::([\s\S]*?)\]/);
        let extraImages: string[] = [];
        if (galleryMatch) {
            extraImages = galleryMatch[1].split("::").filter(u => u.trim());
            workingText = workingText.replace(galleryMatch[0], ""); 
        }

        const segments = workingText.split(/(<draw>[\s\S]*?<\/draw>)/g);

        return (
            <div className="flex flex-col gap-2">
                <span className="whitespace-pre-wrap leading-relaxed">
                    {segments.map((segment, i) => {
                        // Draw tags have been stripped; their pending cards render below each assistant reply.

                        const textParts = smartColorize(segment, selfColors);
                        return (
                            <span key={i}>
                                {textParts.map((part, j) => {
                                    if (part.type === 'colored') {
                                        return <span key={j} style={{ color: part.color, fontWeight: part.bold ? 'bold' : 'normal' }}>{part.text}</span>;
                                    } else {
                                        const imgParts = part.text.split(/(!\[.*?\]\(.*?\))/g);
                                        return (
                                            <span key={j}>
                                                {imgParts.map((subPart, k) => {
                                                    const imgMatch = subPart.match(/!\[(.*?)\]\((.*?)\)/);
                                                    if (imgMatch) {
                                                        const url = imgMatch[2];
                                                        return <IllustratedImage key={k} src={url} alt={imgMatch[1] || deepText(locale, "chat.illustration")} onOpen={onOpenImage} className="my-2" />;
                                                    }
                                                    return <span key={k}>{subPart}</span>;
                                                })}
                                            </span>
                                        );
                                    }
                                })}
                            </span>
                        );
                    })}
                </span>

                {extraImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {extraImages.map((url, idx) => (
                            <IllustratedImage key={idx} src={url} alt={deepText(locale, "chat.galleryImage")} onOpen={onOpenImage} compact />
                        ))}
                    </div>
                )}
            </div>
        );
    } catch (error) {
        return <span className="text-gray-800 whitespace-pre-wrap">{text}</span>;
    }
};

const COLOR_MAP: Record<string, string> = {};
CHARACTERS.forEach(c => {
    const key = c.hex.toLowerCase();
    COLOR_MAP[key] = c.id;
});

type DialogueLine = {
    charId: string;   
    charName: string; 
    text: string;     
    color: string;    
};

const parseDialogue = (fullText: string, defaultCharId: string): DialogueLine[] => {
    const lines: DialogueLine[] = [];

    const parts = fullText.split(/(\{\{\s*#?[a-fA-F0-9]{6}\s*\|\s*[\s\S]*?\s*\}\})/g);

    parts.forEach(part => {
        const match = part.match(/\{\{\s*(#?[a-fA-F0-9]{6})\s*\|\s*([\s\S]*?)\s*\}\}/);
        if (match) {
            let color = match[1].toLowerCase();
            if (!color.startsWith("#")) color = "#" + color;
            const content = match[2].trim();

            const charId = COLOR_MAP[color];
            const charInfo = CHARACTERS.find(c => c.id === charId);

            if (charId && charInfo) {
                lines.push({
                    charId: charId,
                    charName: charInfo.name,
                    text: content,
                    color: color
                });
            } else {
            }
        } else {
        }
    });

    if (lines.length === 0 && fullText.trim()) {
        const charInfo = CHARACTERS.find(c => c.id === defaultCharId);
        lines.push({
            charId: defaultCharId,
            charName: charInfo?.name || "AI",
            text: fullText.trim(),
            color: charInfo?.hex || "#000"
        });
    }

    return lines;
};

const DialoguePlayer = ({ content, defaultCharId, onPlay, msgIndex, currentLock }: any) => {
    const { locale } = useLanguage();
    const dialog = useAppDialog();
    const lines = parseDialogue(content, defaultCharId);

    if (lines.length === 0) return <span className="text-[10px] text-gray-300 px-2">{deepText(locale, "chat.toolbar.noDialogue")}</span>;

    const handleClick = async (text: string, charId: string, idx: number) => {
        if (currentLock) return;

        const charName = CHARACTERS.find(c => c.id === charId)?.name || charId;
        if (!await dialog.confirm(`${deepText(locale, "chat.generateVoicePrefix")} [${charName}]${deepText(locale, "chat.generateVoiceSuffix")}`)) {
            return;
        }

        onPlay(text, charId, msgIndex, idx);
    };

    return (
        <div className="flex flex-col gap-1 p-2 bg-white/95 backdrop-blur-md rounded-xl border border-gray-100 shadow-xl min-w-[220px] max-w-[300px]">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1 mb-1 px-1 flex justify-between items-center">
                <span>{deepText(locale, "chat.toolbar.voiceDeck")}</span>
                <span className={`text-[9px] px-1 rounded transition-colors ${currentLock ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>
                    {deepText(locale, currentLock ? "chat.toolbar.gpuBusy" : "chat.toolbar.gpuReady")}
                </span>
            </div>

            {lines.map((line, idx) => {
                const isThisLineLoading = currentLock?.msgId === msgIndex && currentLock?.lineIdx === idx;
                const isDisabled = currentLock !== null;

                return (
                    <button
                        key={idx}
                        disabled={isDisabled}
                        onClick={(e) => { e.stopPropagation(); handleClick(line.text, line.charId, idx); }}
                        className={`
                            flex items-center gap-2.5 text-left p-2 rounded-lg transition-all duration-200 group
                            ${isThisLineLoading ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-gray-50 hover:shadow-sm'}
                            ${isDisabled && !isThisLineLoading ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                        `}
                    >
                        <div
                            className="w-1.5 h-8 rounded-full shrink-0 transition-all group-hover:scale-y-110"
                            style={{ backgroundColor: line.color }}
                        />

                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black leading-none mb-1 opacity-80" style={{ color: line.color }}>
                                {line.charName}
                            </div>
                            <div className="text-xs truncate text-slate-600 font-medium group-hover:text-slate-900">
                                {line.text}
                            </div>
                        </div>

                        <div className="text-gray-300 group-hover:text-emerald-500 shrink-0 transition-colors">
                            {isThisLineLoading ? (
                                <Loader2 size={14} className="animate-spin text-emerald-500" />
                            ) : (
                                <Volume2 size={14} />
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

const Portal = ({ children }: { children: React.ReactNode }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    return createPortal(children, document.body);
};

export const ChatInterface = ({
    leftSidebarOpen, setLeftSidebarOpen,
    rightSidebarOpen, setRightSidebarOpen,
    setShowLocalWorld, onOpenStoryWorldline, onOpenChatWorldline,

    currentCharacter, currentSession,
    input, setInput, isLoading,

    selectedModel, customModelId, isMultimodal,

    selectedFile, setSelectedFile,
    fileInputRef, handleFileSelect,

    handleSend, stopGeneration,
    handleRegenerate, handleDeleteMessage,
    handleCopy, copiedIndex, openEditModal,

    voiceVariant, setVoiceVariant,
    handlePlayAudio, playingIndex,

    toggleMemoryMode, setSessions,
    toggleSaveModal,
    toggleCodeRepo,
    dbChars,
    useTTS,
    showToast,
    isGlobalGenerating,
    toggleWardrobe,
    apiProvider, setApiProvider,
    debugMode, setDebugMode, showDrawDebugTags = false,
    onGenerateDraw, imageSettings, useImageGen, onCompleteEngineeringOutput, onCompleteStoryState, onCompleteMissingMetadata, storyStateRepairing = false,
    triggerEffect,

    currentOutfitId,
    setManualOutfitId,
    createNewSession,
    onOpenHub, onOpenSettings, onOpenMemory,
    effectiveConfig,
    charName, outfits,
}: any) => {

    const { locale } = useLanguage();
    const dialog = useAppDialog();
    const requiresWorldline = currentSession?.memoryMode === "sliding" && !parseStoryWorldline(currentSession.storyWorldline);
    const requiresEngineer = currentSession?.memoryMode === "infinite" && !currentSession.characterId;
    const requiresChatWorldline = currentSession?.memoryMode === "chat" && !parseStoryWorldline(currentSession.storyWorldline);
    const requiresChatCharacter = currentSession?.memoryMode === "chat" && !currentSession.characterId;
    const inputLocked = requiresWorldline || requiresEngineer || requiresChatWorldline || requiresChatCharacter || storyStateRepairing;
    const savedSelf = currentSession?.memoryMode === "sliding" && currentSession.storyRole === "participant"
        ? currentSession.storySelfSnapshot : null;
    const selfColors: Record<string, string> = savedSelf?.hex && savedSelf?.names
        ? Object.fromEntries(Object.values(savedSelf.names).map(name => [String(name), savedSelf.hex])) : {};
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showFullPlayer, setShowFullPlayer] = useState(false);
    const { isPlaying } = useMusic();

    const [drawingIndex, setDrawingIndex] = useState<number | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const confirmDraw = async (index: number) => {
        if (drawingIndex !== null) return;
        if (!useImageGen) { showToast(deepText(locale, "chat.drawDisabled")); return; }
        if (!await dialog.confirm(deepText(locale, "chat.drawConfirm"))) return;
        setDrawingIndex(index);
        try { await onGenerateDraw(index); }
        catch (error) { showToast(`${deepText(locale, "chat.drawFailed")}${error instanceof Error ? error.message : deepText(locale, "chat.unknownError")}`); }
        finally { setDrawingIndex(null); }
    };

    const confirmStopGeneration = async () => {
        if (await dialog.confirm(deepText(locale, "chat.stopConfirm"), { destructive: true })) stopGeneration();
    };

    const [showMobileTopMenu, setShowMobileTopMenu] = useState(false);

    const [showSettings, setShowSettings] = useState(false);
    const [consoleVisible, setConsoleVisible] = useState(true); 

    const toggleDebugConsole = () => {
        const vcSwitch = document.querySelector('.vc-switch') as HTMLElement;
        if (vcSwitch) {
            const nextState = vcSwitch.style.display === 'none' ? 'block' : 'none';
            vcSwitch.style.display = nextState;
            setConsoleVisible(nextState === 'block');
        } else {
            showToast(deepText(locale, "chat.toolbar.consoleMissing"));
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [currentSession?.messages, currentSession?.id, isLoading]);

    const parseResponse = (text: string) => {
        const pattern = /<thinking>([\s\S]*?)<\/thinking>/;
        const match = text.match(pattern);
        if (match) return { thought: match[1].trim(), answer: text.replace(pattern, "").trim() };
        return { thought: null, answer: text };
    };

    const [ttsMenu, setTtsMenu] = useState<{ id: number; top: number; left: number } | null>(null);

    const [generatingLock, setGeneratingLock] = useState<{ msgId: number, lineIdx: number } | null>(null);

    const toggleTTSMenu = (e: React.MouseEvent, index: number) => {
        if (ttsMenu?.id === index) {
            setTtsMenu(null);
            return;
        }

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

        setTtsMenu({
            id: index,
            top: rect.top - 10,
            left: rect.right + 10
        });
    };

    useEffect(() => {
        const closeMenu = () => setTtsMenu(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const executeTTS = async (text: string, charId: string, msgId: number, lineIdx: number) => {
        if (generatingLock) return;

        setGeneratingLock({ msgId, lineIdx });

        let targetId = charId;
        if (targetId === "soyo") targetId = voiceVariant === "down" ? "soyo_down" : "soyo_up";
        if (targetId === "sakiko") targetId = voiceVariant === "white" ? "sakiko" : "oblivionis";
        if (targetId === "mutsu") targetId = voiceVariant === "mortis" ? "mortis" : "mutsu";

        if (showToast) showToast(`${deepText(locale, "chat.toolbar.audioRequest")} ${targetId}…`);

        try {
            await handlePlayAudio(text, -1, targetId);
        } catch (e) {
            console.error(e);
        } finally {
            setGeneratingLock(null);
        }
    };

    const ToolButtons = ({ isMobile = false }) => (
        <>
            {currentSession?.memoryMode === 'sliding' && (
                <>
                    <button onClick={toggleSaveModal} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold border bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600 hover:bg-fuchsia-100 ${isMobile ? 'w-full justify-center' : ''}`}><Save size={16} /> <span className={isMobile ? "inline" : "hidden md:inline"}>{deepText(locale, "common.save")}</span></button>
                    <div className={`flex gap-1 ${isMobile ? 'w-full justify-center' : ''}`}>
                        <button onClick={() => setShowLocalWorld(true)} title={`Via Lata · ${deepText(locale, "chat.toolbar.storyNotes")}`} className="flex items-center gap-1.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1.5 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100"><BookOpen size={15} /> <span>{deepText(locale, "chat.toolbar.storyNotes")}</span></button>
                    </div>
                </>
            )}

            {currentSession?.memoryMode === 'chat' && (
                <>
                    <button onClick={() => setShowLocalWorld(true)} title={`Umbra · ${deepText(locale, "chat.toolbar.chatNotes")}`} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"><StickyNote size={15} /> <span>{deepText(locale, "chat.toolbar.chatNotes")}</span></button>
                </>
            )}

            {currentSession?.memoryMode === 'infinite' && (
                <>
                    <button onClick={toggleCodeRepo} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold border bg-slate-800 text-blue-400 hover:bg-slate-700 shadow-sm ${isMobile ? 'w-full justify-center' : ''}`}><Terminal size={16} /> <span className={isMobile ? "inline" : "hidden md:inline"}>IDE</span></button>
                    <button onClick={() => setShowLocalWorld(true)} title={`Officina · ${deepText(locale, "chat.toolbar.sessionGuide")}`} className={`flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 ${isMobile ? 'w-full justify-center' : ''}`}><ClipboardList size={16} /> <span>{deepText(locale, "chat.toolbar.sessionGuide")}</span></button>
                </>
            )}
        </>
    );

    return (
        <div className="flex-1 flex flex-col relative min-w-0" style={{ backgroundColor: (requiresEngineer || requiresChatWorldline || requiresChatCharacter) ? "#f3f7f4" : currentCharacter.hex + "08" }}>

            <header className={`
          flex items-center justify-between px-3 md:px-4 bg-white md:bg-white/80 md:backdrop-blur z-20 border-b border-gray-100/50 shrink-0 relative
          pt-safe h-[calc(3.5rem+env(safe-area-inset-top))]
      `}>

                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    {!leftSidebarOpen && (
                        <button onClick={() => setLeftSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors"><Menu size={18} /></button>
                    )}
                    <div className="flex flex-col min-w-0 justify-center">
                        <span className="text-sm font-bold flex items-center gap-2 truncate">
                            {currentSession?.memoryMode === 'sliding' ? (
                                <span className="flex items-center gap-2 text-lg font-semibold tracking-wide text-[#466957]">
                                    <Route size={19} className="text-[#a38c65]" aria-hidden="true" />
                                    <span>Via Lata</span>
                                </span>
                            ) : currentSession?.memoryMode === 'chat' ? (
                                <span className="flex items-center gap-2 truncate text-[#527762]">
                                    <TreeDeciduous size={19} className="shrink-0 text-[#729481]" aria-hidden="true" />
                                    <span className="font-semibold tracking-wide">Umbra</span>
                                    {!requiresChatCharacter && <span className="truncate text-[11px] text-slate-500">· {characterDisplayName(currentCharacter.id, currentCharacter.name, locale)}</span>}
                                </span>
                            ) : (
                                <span className="flex items-center gap-2 truncate text-[#365b75]">
                                    <Hammer size={18} className="shrink-0 text-[#6487a1]" aria-hidden="true" />
                                    <span className="font-semibold tracking-wide">Officina</span>
                                    {!requiresEngineer && <span className="truncate text-[11px] text-slate-500">· {characterDisplayName(currentCharacter.id, currentCharacter.name, locale)}</span>}
                                </span>
                            )}
                        </span>

                        <span className="text-[10px] text-gray-400 truncate max-w-[120px] md:max-w-xs block">
                            {(customModelId || selectedModel) ? (customModelId || selectedModel.split('/').pop()) : deepText(locale, "chat.toolbar.noModel")}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2">

                    <button type="button" onClick={onOpenHub} className="rounded-full p-2 text-slate-500 transition-colors hover:bg-gray-100" title={deepText(locale, "chat.toolbar.home")} aria-label={deepText(locale, "chat.toolbar.home")}><House size={19} /></button>
                    {currentSession?.memoryMode !== "infinite" && <button type="button" onClick={onOpenMemory} className="hidden md:inline-flex rounded-full p-2 text-slate-500 transition-colors hover:bg-gray-100" title={deepText(locale, "chat.toolbar.memoryVault")} aria-label={deepText(locale, "chat.toolbar.memoryVault")}><Brain size={19} /></button>}

                    <div className="relative">
                        <button
                            onClick={onOpenSettings}
                            className="p-2 rounded-full text-gray-500 transition-colors hover:bg-gray-100"
                            title={deepText(locale, "common.settings")}
                        >
                            <Settings size={20} />
                        </button>

                        <AnimatePresence>
                            {showSettings && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full right-0 mt-2 w-48 bg-white/95 backdrop-blur border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden p-1"
                                >
                                    {debugMode && <div className="md:hidden">
                                        <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{deepText(locale, "chat.toolbar.mobileTools")}</div>
                                        <button
                                            onClick={toggleDebugConsole}
                                            className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                        >
                                            <span>{deepText(locale, "chat.toolbar.debugConsole")}</span>
                                            {consoleVisible ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} className="text-gray-300" />}
                                        </button>
                                    </div>}

                                    <div className="border-t border-gray-100 mt-1 pt-1 px-3 py-2">
                                        <button
                                            onClick={() => setDebugMode(!debugMode)}
                                            className={`w-full flex items-center justify-between text-xs font-bold p-2 rounded-lg transition-all ${debugMode
                                                ? 'bg-red-50 text-red-600 border border-red-200'
                                                : 'bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Terminal size={14} /> 
                                                <span>{deepText(locale, "chat.toolbar.debugMode")}</span>
                                            </span>
                                            <div className={`w-2 h-2 rounded-full ${debugMode ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                                        </button>
                                        <p className="text-[9px] text-gray-300 mt-1 text-center">
                                            {deepText(locale, "chat.toolbar.debugHelp")}
                                        </p>
                                    </div>

                                    <div className="border-t border-gray-100 mt-1 pt-1 px-3 py-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{deepText(locale, "chat.toolbar.devTools")}</div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <button onClick={() => triggerEffect("rain")} className="aspect-square bg-blue-50 text-blue-500 rounded flex items-center justify-center hover:bg-blue-100" title={deepText(locale, "chat.toolbar.rain")}>
                                                <CloudRain size={14} />
                                            </button>
                                            <button onClick={() => triggerEffect("curtain")} className="aspect-square bg-red-50 text-red-500 rounded flex items-center justify-center hover:bg-red-100" title={deepText(locale, "chat.toolbar.curtain")}>
                                                <AlertTriangle size={14} />
                                            </button>
                                            <button onClick={() => triggerEffect("math")} className="aspect-square bg-emerald-50 text-emerald-500 rounded flex items-center justify-center hover:bg-emerald-100" title={deepText(locale, "chat.toolbar.math")}>
                                                <Binary size={14} />
                                            </button>
                                            <button onClick={() => triggerEffect("glitch")} className="aspect-square bg-black text-red-500 rounded flex items-center justify-center hover:bg-zinc-800" title={deepText(locale, "chat.toolbar.glitch")}>
                                                <Skull size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="relative"> 
                        <button
                            onClick={() => setShowFullPlayer(true)}
                            className={`relative hidden md:inline-flex p-2 hover:bg-gray-100 rounded-full transition-colors ${isPlaying ? 'text-rose-500' : 'text-gray-400'}`}
                            title={deepText(locale, "chat.toolbar.musicPlayer")}
                        >
                            <Disc size={20} className={isPlaying ? "animate-spin-slow" : ""} style={{ animationDuration: '3s' }} />

                            {isPlaying && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white z-10"></span>
                            )}
                        </button>
                    </div>


                    <div className="hidden md:flex items-center gap-1">
                        <ToolButtons isMobile={false} />
                    </div>

                    <div className="md:hidden">
                        <button
                            onClick={() => setShowMobileTopMenu(!showMobileTopMenu)}
                            className={`p-2 rounded-full transition-colors ${showMobileTopMenu ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}
                        >
                            {showMobileTopMenu ? <ChevronUp size={20} /> : <MoreHorizontal size={20} />}
                        </button>
                    </div>

                    <button onClick={() => setRightSidebarOpen(!rightSidebarOpen)} className="p-2 hover:bg-gray-100 rounded text-gray-500"><Users size={18} /></button>
                </div>
            </header>

            <AnimatePresence>
                {showMobileTopMenu && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="md:hidden bg-white/90 backdrop-blur border-b border-gray-100 overflow-hidden z-10 shadow-sm"
                    >
                        <div className="p-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <ToolButtons isMobile={true} />
                            {currentSession?.memoryMode !== "infinite" && (
                                <button type="button" onClick={() => { setShowMobileTopMenu(false); onOpenMemory(); }}
                                    className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-semibold text-emerald-700"
                                    aria-label={deepText(locale, "chat.toolbar.memoryVault")}>
                                    <Brain size={16}/>{deepText(locale, "chat.toolbar.memoryVault")}
                                </button>
                            )}
                            <button type="button" onClick={() => { setShowMobileTopMenu(false); setShowFullPlayer(true); }}
                                className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                                aria-label={deepText(locale, "chat.toolbar.musicPlayer")}>
                                <Disc size={16}/>{deepText(locale, "chat.toolbar.musicPlayer")}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="z-10 hidden md:block">
                <MiniPlayer
                    onExpand={() => setShowFullPlayer(true)}
                    rightSidebarOpen={rightSidebarOpen}
                    themeMode="light"
                />
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 md:pr-[350px] space-y-8 scroll-smooth">
                {currentSession?.messages.map((msg: any, i: number) => {
                    let txt = "";
                    let files: any[] = [];
                    if (Array.isArray(msg.content)) {
                        msg.content.forEach((x: any) => {
                            if (x.type === 'text') txt += x.text;
                            if (x.type === 'image_url') files.push(x.image_url.url)
                        })
                    } else {
                        txt = msg.content;
                    }

                    const { thought, answer } = msg.role === 'assistant' ? parseResponse(txt) : { thought: null, answer: txt };

                    const activeDrawMatch = txt.match(/<draw>([\s\S]*?)<\/draw>/);
                    const logDrawMatch = txt.match(/<draw_log>([\s\S]*?)<\/draw_log>/);

                    const rawDrawContent = (activeDrawMatch ? activeDrawMatch[1] : (logDrawMatch ? logDrawMatch[1] : null))?.trim();
                    const drawDebugRequest = rawDrawContent && msg.role === 'assistant'
                        ? buildDrawRequest(activeDrawMatch ? txt : txt.replaceAll("<draw_log>", "<draw>").replaceAll("</draw_log>", "</draw>"), { activeCharacterId: msg.characterId || currentSession.characterId,
                            characters: dbChars, charStatus: currentSession.charStatus,
                            settings: imageSettings })
                        : null;

                    const msgCharId = msg.characterId || currentSession.characterId;
                    const msgChar = (dbChars?.length ? dbChars : CHARACTERS).find((c: any) => c.id === msgCharId) || currentCharacter;

                    const isLast = i === currentSession.messages.length - 1;
                    const isSecondLast = i === currentSession.messages.length - 2;
                    const isLastUserMsg = msg.role === 'user' && (isLast || isSecondLast);

                    if (msg.role === 'assistant' && !answer && !thought && !files.length && !msg.ideEditedFiles?.length) return null;

                    return (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={i} className={`group flex gap-4 max-w-3xl md:max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs border-2 border-white flex-shrink-0 shadow-sm relative group/avatar"
                                    style={{ backgroundColor: msg.modelName === "System" ? "#8da2b4" : currentSession?.memoryMode === 'sliding' ? '#e11e54' : msgChar.hex }}>
                                    {msg.modelName === "System" ? (currentSession.memoryMode === "chat" ? <TreeDeciduous size={14} /> : <Hammer size={14} />) : currentSession?.memoryMode === 'sliding' ? <Guitar size={14} /> : msgChar.avatar}
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5 max-w-[85%] items-start w-full">
                                {currentSession.memoryMode === "chat" && msg.role === "assistant" && msg.modelName !== "System" &&
                                  <span className="px-1 text-[10px] font-semibold text-[#638671]">
                                    {characterDisplayName(msgChar.id, msgChar.name, locale)} · {msgChar.sub || "Umbra"}
                                  </span>}

                                {files.length > 0 && <div className="flex gap-2 justify-end w-full flex-wrap">{files.map((f: any, idx: number) => <IllustratedImage key={idx} src={f} alt={deepText(locale, "chat.attached")} compact onOpen={setPreviewImage} />)}</div>}

                                {thought && currentSession.memoryMode === 'infinite' && <ThinkingBlock thought={thought} />}

                                {answer && (msg.role !== 'assistant' || Boolean(cleanDrawTag(answer).trim())) && (
                                    <div className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm w-fit ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-br-none ml-auto' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                                        {msg.role === 'assistant'
                                            ? currentSession.memoryMode === "infinite"
                                                ? <div className="officina-response whitespace-pre-wrap break-words">
                                                    <ReactMarkdown components={{
                                                        strong: ({ children }) => <strong className="font-extrabold text-[#17212b]">{children}</strong>,
                                                        p: ({ children }) => <p className="my-1.5 whitespace-pre-wrap">{children}</p>,
                                                        pre: ({ children }) => <pre className="my-3 max-w-full overflow-x-auto rounded-xl border border-[#ceddf0] bg-[#f0f6fd] px-3 py-3 text-[12px] leading-5 text-[#254060] whitespace-pre">{children}</pre>,
                                                        code: ({ className, children }) => <code className={className ? `font-mono ${className}` : "rounded bg-[#eaf2fb] px-1 py-0.5 font-mono text-[12px] text-[#28518a]"}>{children}</code>,
                                                        img: ({ src, alt }) => typeof src === "string" ? <IllustratedImage src={src} alt={alt || deepText(locale, "chat.picture")} onOpen={setPreviewImage} className="my-2" /> : null,
                                                    }}>{formatOfficinaStreamingDisplay(cleanDrawTag(answer))}</ReactMarkdown>
                                                </div>
                                                : renderContent(answer, setPreviewImage, locale, selfColors)
                                            : <div className="whitespace-pre-wrap">{answer}</div>}
                                        {msg.role === 'assistant' && msg.modelName && msg.modelName !== "System" && <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1.5 text-[9px] font-bold tracking-wider opacity-40 uppercase"><Cpu size={10} /> {msg.modelName.split('/').pop()}</div>}
                                    </div>
                                )}
                                {currentSession.memoryMode === "infinite" && msg.role === "assistant" && Array.isArray(msg.ideEditedFiles) && msg.ideEditedFiles.length > 0 && (
                                    <section aria-label={deepText(locale, "chat.ideResult")} className="mt-2 w-full min-w-0 overflow-hidden rounded-xl border border-[#bad5ef] bg-[#f5faff] shadow-[0_4px_16px_rgba(33,92,148,.07)]">
                                        <header className="flex items-center gap-2 border-b border-[#d7e6f4] bg-[#e8f3ff] px-3 py-2.5 text-[#285d8d]">
                                            <FileCheck2 size={16} className="shrink-0" />
                                            <span className="flex-1 text-xs font-bold">{deepText(locale, "chat.ideResult")}</span>
                                            <span className="rounded-full bg-[#d8eaff] px-2 py-0.5 text-[10px] font-semibold">{msg.ideEditedFiles.length} {deepText(locale, "chat.fileCount")}</span>
                                        </header>
                                        <div className="divide-y divide-[#e2edf8]">
                                            {msg.ideEditedFiles.map((file: { path: string; operations: number; added: number; removed: number }, index: number) => (
                                                <div key={`${file.path}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <FileText size={14} className="shrink-0 text-[#6090bc]" />
                                                        <span className="break-all font-mono text-[11px] font-semibold text-[#294a70]">{file.path}</span>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2 text-[10px] font-mono">
                                                        <span className="text-[#3d698d]">{file.operations} {deepText(locale, "chat.operationCount")}</span>
                                                        <span className="font-bold text-[#258051]">+{file.added}</span>
                                                        <span className="font-bold text-[#b64c5c]">-{file.removed}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                {currentSession.memoryMode === "infinite" && msg.role === "assistant" && msg.engineeringOutputIncomplete && (
                                    <div role="status" className="mt-2 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                                        <AlertTriangle size={15} className="shrink-0"/>
                                        <span className="flex-1">{deepText(locale, "chat.codeIncomplete")}</span>
                                        <button type="button" disabled={isLoading} onClick={() => onCompleteEngineeringOutput?.(i)}
                                            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40">{deepText(locale, "chat.confirmComplete")}</button>
                                    </div>
                                )}
                                {msg.role === 'assistant' && msg.storyProtocolMissing && (
                                     <div role="status" className="mt-2 flex items-center gap-3 rounded-xl border border-[#ecc3d3] bg-[#fff3f7] p-3 text-[11px] leading-5 text-[#8a3453]">
                                         <AlertTriangle size={15} className="shrink-0"/>
                                         <span className="flex-1">{deepText(locale, "chat.storyProtocolIncomplete")}</span>
                                         <button type="button" disabled={isLoading || i !== currentSession.messages.length - 1}
                                             onClick={() => onCompleteStoryState?.(i)}
                                             className="shrink-0 rounded-lg border border-[#dca3bb] bg-white px-3 py-1.5 font-semibold text-[#922c55] disabled:opacity-40">
                                             {storyStateRepairing ? deepText(locale, "chat.repairing") : deepText(locale, "chat.confirmRepair")}
                                         </button>
                                     </div>
                                 )}
                                {msg.role === 'assistant' && msg.metadataRepairMissing && !msg.storyProtocolMissing && (
                                    <div role="status" className={`mt-2 flex items-center gap-3 rounded-xl border p-3 text-[11px] leading-5 ${currentSession.memoryMode === "chat" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
                                        <AlertTriangle size={15} className="shrink-0"/>
                                        <span className="flex-1">{deepText(locale, "chat.metadataIncomplete")}</span>
                                        <button type="button" disabled={isLoading || storyStateRepairing || i !== currentSession.messages.length - 1}
                                            onClick={() => onCompleteMissingMetadata?.(i)}
                                            className="shrink-0 rounded-lg border border-current/20 bg-white px-3 py-1.5 font-semibold disabled:opacity-40">
                                            {storyStateRepairing ? deepText(locale, "chat.repairing") : deepText(locale, "chat.repairState")}
                                        </button>
                                    </div>
                                )}
                                {msg.role === 'assistant' && activeDrawMatch && (
                                    <DrawPlaceholder locale={locale} busy={drawingIndex === i} disabled={drawingIndex !== null}
                                        mode={currentSession.memoryMode === "sliding" ? "sliding" : currentSession.memoryMode === "chat" ? "chat" : "infinite"}
                                        onGenerate={() => void confirmDraw(i)} />
                                )}

                                {debugMode && showDrawDebugTags && rawDrawContent && msg.role === 'assistant' && (
                                    <div className="w-full mt-2 p-3 bg-[#1e1e1e] rounded-lg border border-yellow-500/30 text-left font-mono text-[10px] shadow-inner overflow-hidden select-text">
                                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/10 text-yellow-500">
                                            <span className="flex items-center gap-2 font-bold tracking-wider">
                                                <Terminal size={12} /> AI VISUAL INSTRUCTION
                                            </span>
                                            <span className="text-[9px] opacity-50">DEBUG · FULL REQUEST</span>
                                        </div>
                                        <pre className="whitespace-pre-wrap break-all text-gray-300">
                                            {(() => {
                                                try { return JSON.stringify({ instruction: JSON.parse(rawDrawContent), request: drawDebugRequest }, null, 2); }
                                                catch { return JSON.stringify({ instruction: rawDrawContent, request: drawDebugRequest }, null, 2); }
                                            })()}
                                        </pre>
                                    </div>
                                )}

                                <div className={`flex items-center gap-2 transition-opacity text-gray-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 ${msg.role === 'user' ? 'justify-end w-full' : ''}`}>
                                    {msg.role === 'user' ? (
                                        isLastUserMsg && (
                                            <>
                                                <button title={deepText(locale, "chat.toolbar.edit")} aria-label={deepText(locale, "chat.toolbar.edit")} onClick={() => openEditModal(i, msg.content)} className="p-1 hover:text-emerald-500 rounded"><Pencil size={12} /></button>
                                                <button title={deepText(locale, "chat.toolbar.delete")} aria-label={deepText(locale, "chat.toolbar.delete")} onClick={() => handleDeleteMessage(i, 'user')} className="p-1 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                                            </>
                                        )
                                    ) : msg.modelName === "System" ? null : (
                                        <>
                                            {useTTS && (
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); 
                                                            toggleTTSMenu(e, i);
                                                        }}
                                                        className={`p-1 rounded transition-colors ${ttsMenu?.id === i ? 'bg-emerald-100 text-emerald-600' : 'hover:text-emerald-500 text-gray-400'}`}
                                                        title={deepText(locale, "chat.toolbar.voiceSelect")}
                                                    >
                                                        <Volume2 size={12} />
                                                    </button>

                                                    {ttsMenu?.id === i && (
                                                        <Portal>
                                                            <div
                                                                className="fixed inset-0 z-[9998] cursor-default"
                                                                onClick={() => setTtsMenu(null)}
                                                            />

                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                                                style={{
                                                                    position: 'fixed',
                                                                    top: ttsMenu.top,
                                                                    left: ttsMenu.left,
                                                                    transform: 'translateY(-100%)', 
                                                                }}
                                                                className="z-[9999]" 
                                                                onClick={(e) => e.stopPropagation()} 
                                                            >
                                                                <DialoguePlayer
                                                                    content={Array.isArray(msg.content)
                                                                        ? msg.content.find((c: any) => c.type === 'text')?.text || ""
                                                                        : msg.content}
                                                                    defaultCharId={msgCharId}
                                                                    onPlay={executeTTS}
                                                                    msgIndex={i}             
                                                                    currentLock={generatingLock || (isGlobalGenerating ? { msgId: -1, lineIdx: -1 } : null)}
                                                                />
                                                            </motion.div>
                                                        </Portal>
                                                    )}
                                                </div>
                                            )}
                                            <button title={deepText(locale, "common.retry")} aria-label={deepText(locale, "common.retry")} onClick={() => handleRegenerate(i)} className="p-1 hover:text-emerald-500 rounded"><RefreshCw size={12} /></button>
                                            <button title={deepText(locale, copiedIndex === i ? "chat.toolbar.copied" : "common.copy")} aria-label={deepText(locale, copiedIndex === i ? "chat.toolbar.copied" : "common.copy")} onClick={() => handleCopy(answer, i)} className="p-1 hover:text-emerald-500 rounded">{copiedIndex === i ? <Check size={12} /> : <Copy size={12} />}</button>
                                            {isLast && <button title={deepText(locale, "chat.toolbar.delete")} aria-label={deepText(locale, "chat.toolbar.delete")} onClick={() => handleDeleteMessage(i, 'assistant')} className="p-1 hover:text-red-500 rounded"><Trash2 size={12} /></button>}
                                        </>
                                    )}
                                </div>
                            </div>
                            {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-gray-500 flex-shrink-0"><Moon size={14} /></div>}
                        </motion.div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white md:bg-white/50 md:backdrop-blur-sm shrink-0">
                {(requiresChatWorldline || requiresChatCharacter) && <div role="status"
                    className="mx-auto mb-3 flex max-w-3xl items-center gap-2 rounded-xl border border-[#dce8df] bg-[#f7faf8] px-4 py-3 text-xs text-[#557968]">
                    <TreeDeciduous size={16}/>
                    {requiresChatWorldline ? deepText(locale, "chat.needUmbraWorldline") : deepText(locale, "chat.needCharacter")}
                    <button type="button" onClick={() => requiresChatWorldline ? onOpenChatWorldline() : setRightSidebarOpen(true)}
                        className="ml-auto shrink-0 rounded-lg border border-[#d9e5dd] bg-white px-3 py-2 text-xs font-semibold">
                        {requiresChatWorldline ? deepText(locale, "chat.configureWorldline") : deepText(locale, "chat.chooseCharacter")}
                    </button>
                </div>}
                {requiresEngineer && <div role="status" className="mx-auto mb-3 flex max-w-3xl items-center gap-2 rounded-xl border border-[#dce4ea] bg-[#f7fafb] px-4 py-3 text-xs text-[#5b7588]">
                    <Hammer size={16} />{deepText(locale, "chat.needEngineer")}
                    <button type="button" className="ml-auto rounded-lg border border-[#d6e3e9] bg-white px-3 py-2 text-xs font-semibold" onClick={() => setRightSidebarOpen(true)}>{deepText(locale, "chat.chooseCharacter")}</button>
                </div>}
                {requiresWorldline && <div role="status" className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dcccae] bg-[#fbf7ee] px-4 py-3 text-xs text-[#776342]">
                    <span className="flex items-center gap-2"><AlertTriangle size={16}/>{deepText(locale, "chat.needStoryWorldline")}</span>
                    <button type="button" onClick={onOpenStoryWorldline} className="rounded-lg bg-[#324d42] px-3 py-2 font-semibold text-[#f7ecd0] hover:bg-[#203d32]">{deepText(locale, "chat.storyWorldlineAction")} ↗</button>
                </div>}
                <div
                    className="max-w-3xl mx-auto relative bg-white rounded-2xl border flex items-end focus-within:ring-1 transition-all shadow-sm"
                    style={{
                        borderColor: currentSession?.memoryMode === 'sliding'
                            ? '#e11e54'
                            : (isLoading ? currentCharacter.hex : '#e5e7eb'),

                        boxShadow: isLoading ? `0 0 10px ${currentCharacter.hex}20` : 'none'
                    }}
                >
                    <textarea value={input} disabled={inputLocked} style={{ caretColor: currentCharacter.hex }} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!inputLocked) handleSend() } }} placeholder={storyStateRepairing ? deepText(locale, "chat.waitRepair") : requiresChatWorldline ? deepText(locale, "chat.waitUmbraWorldline") : requiresChatCharacter ? deepText(locale, "chat.waitCharacter") : requiresEngineer ? deepText(locale, "chat.waitEngineer") : requiresWorldline ? deepText(locale, "chat.waitWorldline") : currentSession?.memoryMode === 'sliding' ? "Start your dream..." : currentSession?.memoryMode === 'chat' ? `${deepText(locale, "chat.talkPrefix")}${currentCharacter.name}${deepText(locale, "chat.talkSuffix")}` : `Speak to ${currentCharacter.name}...`} className="w-full bg-transparent border-none outline-none py-3 pl-4 pr-20 resize-none min-h-[50px] max-h-32 text-sm disabled:cursor-not-allowed disabled:bg-[#f8f6f1] disabled:text-[#9a988c]" />
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".txt,.md,.markdown,.json,.jsonl,.csv,.tsv,.xml,.yaml,.yml,.toml,.ini,.log,.js,.jsx,.ts,.tsx,.py,.css,.scss,.html,.htm,.sql,.sh,.bash,.ps1,.java,.kt,.go,.rs,.rb,.php,.c,.cc,.cpp,.h,.hpp,.cs,.swift,.lua,.vue,.svelte,.mjs,.cjs,text/plain,text/markdown,text/csv,application/json" />
                    <div className="absolute bottom-2 right-2 flex gap-1">
                        {isMultimodal && <button disabled={inputLocked} onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-emerald-500 disabled:opacity-30"><Paperclip size={18} /></button>}
                        {isLoading ? <button type="button" aria-label={deepText(locale, "common.stop")} title={deepText(locale, "common.stop")} onClick={() => void confirmStopGeneration()} className="p-1.5 bg-red-500 text-white rounded animate-pulse"><Square size={18} fill="currentColor" /></button> : (!inputLocked && !input.trim() && !selectedFile && currentSession && currentSession.messages.length > 1) ? <button onClick={() => handleRegenerate(currentSession.messages.length - 1)} className="p-1.5 text-white rounded hover:brightness-110 transition-all" style={{ backgroundColor: currentSession?.memoryMode === 'sliding' ? '#e11e54' : currentCharacter.hex }}><RotateCcw size={18} /></button> : <button onClick={() => handleSend()} disabled={inputLocked || (!input.trim() && !selectedFile)} className="p-1.5 text-white rounded disabled:opacity-30 hover:brightness-110 transition-all" style={{ backgroundColor: currentSession?.memoryMode === 'sliding' ? '#e11e54' : currentCharacter.hex }}><Send size={18} /></button>}
                    </div>
                </div>
                {selectedFile && <div className="text-xs text-gray-400 mt-1 ml-2 flex items-center gap-2">{selectedFile.type === 'text' ? <FileText size={12} /> : <Paperclip size={12} />} <span>{selectedFile.name}</span><button onClick={() => setSelectedFile(null)} className="text-red-400">×</button></div>}
            </div>

            <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />
            <MusicPlayerModal isOpen={showFullPlayer} onClose={() => setShowFullPlayer(false)}
            />
        </div>
    );
};