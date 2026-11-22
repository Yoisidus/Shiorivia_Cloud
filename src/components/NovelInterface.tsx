"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Book, Sparkles, Settings2, PanelRight, AlignLeft,
    LogOut, RefreshCw, X, Edit2, Trash2, Check, 
    Save, ArrowUp, FileText, Square,
    AlertTriangle, HardDrive, Brain,
} from "lucide-react";
import { CHARACTERS, type NovelDraft } from "../types";
import { fallbackModelGroups, type LocalModelGroup, type PublicLocalProvider } from "../lib/localProviders";
import { useSavedModels } from "../hooks/useSavedModels";
import { NovelArchiveActions } from "./NovelArchiveActions";
import { StoryWorldlineFateModal } from "./StoryWorldlineFateModal";
import { StoryCastPicker } from "./StoryCastPicker";
import { parseStoryWorldline, describeStoryWorldline, enabledWorldIds, type StoryWorldline } from "../lib/storyWorldline";
import { storyCastAllowed } from "../lib/storyCast";
import { MiniPlayer } from "./MiniPlayer";
import { MusicPlayerModal } from "./MusicPlayerModalV2";
import { useMusic } from "../context/MusicContext";
import { smartColorize } from "../lib/textFormatter";
import { selfName } from "../lib/chartaSelf";
import { parseDrawTag } from "../lib/parseDraw";
import { buildDrawRequest } from "../lib/drawRequest";
import { cleanDrawTag } from "../lib/parseDraw"; 
import { MemoryVaultModal } from "./MemoryVaultModal";
import { parseLocalMemoryEntries } from "../lib/localMemory";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import { characterDisplayName } from "../lib/characterNames";
import { localText } from "../lib/i18nLocal";

import { useAppDialog } from "../context/DialogContext";
import { IllustratedImage, ImageLightbox } from "./IllustrationImage";
import { stripNovelState } from "../lib/novelState";
import { DanmakuOverlay } from "./DanmakuOverlay";
import { extractNovelSuggestions, stripNovelSuggestions } from "../lib/novelSuggestions";

const THEMES = {
    paper: {
        bg: "bg-[#fdf6e3]",
        sidebar: "bg-[#f5eecf]",
        accent: "text-[#d97706]",
        border: "border-[#d0c8a0]",
        text: "text-[#5c5546]",
        title: "text-[#2c2518]",
        inputBg: "bg-[#fffef8]/90",
        placeholder: "placeholder-[#5c5546]/40",
        hover: "hover:bg-[#e6dfc0]",
        prose: "",
        button: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-[#fffef8] shadow-orange-900/20",
        subButton: "bg-[#5c5546]/10 text-[#5c5546]/40 hover:text-[#2c2518]",
        selectBorder: "border-[#d97706]",
        selectBg: "bg-[#d97706]/10",
        selectDot: "bg-[#d97706]",
        focus: "focus:border-[#d97706]"
    }
};

const PRESETS = [0, 1, 2, 3, 4, 5] as const;

const NovelContent = ({ content, onOptionClick, onOptionInsert, onImageOpen, theme, selfColors = {}, locale = "zh-CN", disabled = false, suggestionsOverride }: any) => {
    let clean = cleanDrawTag(stripNovelState(content)) 
        .replace(/<meta.*?\/>/g, "")
        .replace(/<audio>.*?<\/audio>/g, "")
        .replace(/<novel_danmaku\s*>[\s\S]*?<\/novel_danmaku\s*>/gi, "")
        .replace(/<novel_danmaku\b[\s\S]*$/gi, "")
        .trim();

    const suggestions = suggestionsOverride || extractNovelSuggestions(content);
    clean = stripNovelSuggestions(clean);
    const labels: Record<string, [string, string, string]> = {
        "zh-CN": ["趣味", "理智", "激进"], "zh-TW": ["趣味", "理智", "激進"],
        en: ["Playful", "Rational", "Bold"], ja: ["遊び心", "理性的", "大胆"], ko: ["흥미", "이성적", "과감"],
    };
    const translated = labels[locale] || labels["zh-CN"];
    const options = suggestions ? [
        { label: translated[0], text: suggestions.fun, icon: "✦" },
        { label: translated[1], text: suggestions.rational, icon: "◇" },
        { label: translated[2], text: suggestions.radical, icon: "◆" },
    ] : [];

    const parts = clean.split(/(!\[.*?\]\(.*?\))/g);

    const renderedText = (
        <span className="whitespace-pre-wrap">
            {parts.map((part: string, i: number) => {
                const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
                if (imgMatch) {
                    const src = imgMatch[2];
                    return (
                        <span key={i} className="my-6 flex w-full justify-center animate-fade-in">
                            <IllustratedImage src={src} alt={imgMatch[1] || deepText(locale, "novel.toolbar.illustration")} onOpen={onImageOpen} />
                        </span>
                    );
                }

                const coloredSegments = smartColorize(part, selfColors);

                return (
                    <span key={i}>
                        {coloredSegments.map((seg, j) => (
                            <span
                                key={j}
                                style={seg.type === 'colored' ? {
                                    color: seg.color,
                                    fontWeight: seg.bold ? 'bold' : 'normal'
                                } : {}}
                            >
                                {seg.text}
                            </span>
                        ))}
                    </span>
                );
            })}
        </span>
    );

    return (
        <div className="space-y-6">
            <div className="leading-loose text-justify text-base md:text-lg">
                {renderedText}
            </div>

            {options.length > 0 && (
                <div className={`grid grid-cols-1 gap-3 mt-10 pt-8 border-t ${theme.border}`}>
                    <div className={`text-xs font-mono ${theme.accent} tracking-widest uppercase mb-2 opacity-70`}>
                        {deepText(locale, "novel.ui.nextPossibilities")}
                    </div>
                    {options.map((opt, i) => (
                        <div key={i} className={`rounded-xl border ${theme.border} ${theme.inputBg} overflow-hidden`}>
                            <button type="button" onClick={() => onOptionClick(opt.text)} disabled={disabled}
                                className={`text-left w-full p-4 ${theme.hover} transition-all flex gap-4 disabled:opacity-55 disabled:cursor-not-allowed`}>
                                <span className={`font-bold ${theme.accent} shrink-0`}>{opt.icon}</span>
                                <span className="min-w-0"><span className={`block text-[10px] font-semibold tracking-widest ${theme.accent} mb-1`}>{opt.label}</span><span className={`block text-sm ${theme.text} font-medium leading-relaxed`}>{opt.text}</span></span>
                            </button>
                            <div className={`border-t ${theme.border} px-3 py-2 flex justify-end`}>
                                <button type="button" disabled={disabled} onClick={() => onOptionInsert(opt.text)}
                                    className={`rounded-lg border ${theme.border} px-3 py-1.5 text-[11px] font-semibold ${theme.accent} ${theme.hover} disabled:opacity-40`}>{deepText(locale, "novel.suggestion.insert")}</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const NovelInterface = ({
    currentSession, handleSend,
    isLoading, onExit, onOpenSettings, onCompleteMissingMetadata, metadataRepairing = false,
    dbChars, updateSessionTitle,
    deleteMessage, updateSessionInfo,
    handleRegenerate, createNewSession,
    stopGeneration, setIsGlobalGenerating,
    onImageGenerated, setSessions,
    onGenerateDraw, imageSettings, debugMode, useImageGen, showToast, danmakuEnabled = false, danmakuCount = 8,
    syncStatus, onManualSync,
    initialSelectedModel,
    provider, providers = [], onProviderChange,
    selectedModel, customModelId, onModelChange, onCustomModelChange,
    onImportNovelSession,
    storyWorlds = [], customCharacters = [], customSelves = [], activeNovelSelf = null, onOpenCharta,
}: any) => {
    const { locale } = useLanguage();
    const localizedPresets = PRESETS.map(i => ({
        name: deepText(locale, `novel.preset.${i}.name`),
        environment: deepText(locale, `novel.preset.${i}.environment`),
        event: deepText(locale, `novel.preset.${i}.event`),
        style: deepText(locale, `novel.preset.${i}.style`),
    }));
    const dialog = useAppDialog();
    const [leftOpen, setLeftOpen] = useState(false);
    const [rightOpen, setRightOpen] = useState(false);
    const [showMemoryVault, setShowMemoryVault] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const media = window.matchMedia("(max-width: 767px)");
        const syncLayout = () => {
            const mobile = media.matches;
            setIsMobile(mobile);
            // Desktop starts with both docked panels; mobile starts with neither overlay.
            setLeftOpen(!mobile);
            setRightOpen(!mobile);
        };
        syncLayout();
        media.addEventListener("change", syncLayout);
        return () => media.removeEventListener("change", syncLayout);
    }, []);
    const theme = THEMES.paper;

    const confirmStopGeneration = async () => {
        if (await dialog.confirm(deepText(locale, "novel.suggestion.stopAsk"), { destructive: true })) stopGeneration();
    };
    const confirmNovelSuggestion = async (text: string, mode: "send" | "insert") => {
        if (isLoading || !text.trim()) return;
        const accepted = await dialog.confirm(
            mode === "send" ? deepText(locale, "novel.suggestion.sendAsk") : deepText(locale, "novel.suggestion.insertAsk"),
            { title: mode === "send" ? `TELA · ${deepText(locale, "novel.suggestion.sendTitle")}` : `TELA · ${deepText(locale, "novel.suggestion.insertTitle")}`,
              confirmLabel: mode === "send" ? deepText(locale, "story.suggestion.sendConfirm") : deepText(locale, "story.suggestion.insertConfirm"), tone: "tela", preview: text },
        );
        if (!accepted || isLoading) return;
        if (mode === "send") {
            dialog.notify(deepText(locale, "novel.suggestion.sent"), { type: "success", tone: "tela" });
            void handleGenerate("continue", text);
        } else {
            setDirectorInput(text);
            dialog.notify(deepText(locale, "novel.suggestion.inserted"), { type: "success", tone: "tela" });
        }
    };
    const [showFullPlayer, setShowFullPlayer] = useState(false);
    const [worldlineOpen, setWorldlineOpen] = useState(false);

    const [directorInput, setDirectorInput] = useState("");
    const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
    const novelWorldline = parseStoryWorldline(currentSession.storyWorldline);
    const novelRole = currentSession.storyRole === "participant"
        || (currentSession.storyRole === undefined && Boolean(currentSession.novelDraft?.selfId))
        ? "participant" : "observer";
    const novelStarted = currentSession.messages.some((message: any) =>
        message.role === "user" || (message.role === "assistant" && message.modelName !== "System"
          && typeof message.content === "string" && Boolean(message.content.trim())));
    const novelSelf = novelRole === "participant"
        ? currentSession.storySelfSnapshot
          || customSelves.find((item: any) => item.id === (currentSession.storySelfId || currentSession.novelDraft?.selfId))
          || null
        : null;
    const novelSelfId = novelRole === "participant" ? novelSelf?.id || null : null;
    const selfColors: Record<string, string> = novelSelf?.hex && novelSelf?.names
        ? Object.fromEntries(Object.values(novelSelf.names).map(name => [String(name), novelSelf.hex]))
        : {};
    // Identity can be chosen before worldline setup; compatibility is checked after world selection.
    const canParticipate = Boolean(activeNovelSelf && (!novelWorldline || !activeNovelSelf.worldId
        || enabledWorldIds(novelWorldline).includes(activeNovelSelf.worldId)));
    // The same model/provider state powers Engineering, Chat, VIAE and Novel.
    const activeModel = (customModelId || "").trim() || selectedModel || "";
    const [providerModels, setProviderModels] = useState<LocalModelGroup[]>([]);
    useEffect(() => {
        let alive = true;
        if (!provider || provider.startsWith("custom_")) { setProviderModels([]); return; }
        fetch(`/api/providers?models=${encodeURIComponent(provider)}`, { cache: "no-store" })
            .then(r => r.json()).then(data => { if (alive) setProviderModels(Array.isArray(data.groups) ? data.groups : []); })
            .catch(() => { if (alive) setProviderModels([]); });
        return () => { alive = false; };
    }, [provider]);
    const availableModels = (providerModels.length ? providerModels : fallbackModelGroups(provider || "")).flatMap(g => g.models);
    const { savedModels, saveModel, forgetModel } = useSavedModels();
    const savedIds = savedModels[provider] || [];
    const [environment, setEnvironment] = useState("");
    const [event, setEvent] = useState("");
    const [manualStateEdit, setManualStateEdit] = useState(false);
    const [style, setStyle] = useState(deepText(locale, "novel.ui.styleDefault"));

    const [outline, setOutline] = useState(currentSession.localWorldInfo || "");
    // Restore the draft carried by an imported Novel JSON when its new session opens.
    useEffect(() => {
        const draft = currentSession?.novelDraft as NovelDraft | undefined;
        setSelectedCharIds(Array.isArray(currentSession?.storyNextCastIds) ? currentSession.storyNextCastIds
            : Array.isArray(draft?.selectedCharIds) ? draft.selectedCharIds : []);
        setEnvironment(draft?.environment || currentSession?.novelState?.environment || draft?.scenario || "");
        setEvent(draft?.event || currentSession?.novelState?.event || draft?.action || "");
        setManualStateEdit(false);
        setStyle(draft?.style || deepText(locale, "novel.ui.styleDefault"));
        setOutline(currentSession?.localWorldInfo || draft?.outline || "");
        // Legacy themes are displayed as parchment without modifying old archives.
    }, [currentSession?.id]);
    // AI state updates arrive after every chapter; reflect them in the editor.
    useEffect(() => {
        // Synchronize the editor after a completed chapter or checkpoint restoration.
        // Style is global and deliberately never rewound.
        const draft = currentSession.novelDraft;
        setEnvironment(draft?.environment ?? currentSession.novelState?.environment ?? draft?.scenario ?? "");
        setEvent(draft?.event ?? currentSession.novelState?.event ?? draft?.action ?? "");
        setSelectedCharIds(Array.isArray(currentSession.storyNextCastIds)
            ? currentSession.storyNextCastIds
            : Array.isArray(draft?.selectedCharIds) ? draft.selectedCharIds : currentSession.novelState?.nextSceneCastIds ?? []);
        setManualStateEdit(false);
    }, [currentSession?.id, currentSession?.messages?.length, currentSession?.novelState]);
    const hasNovelChapters = currentSession?.messages?.some((message: any) =>
        message.role === "assistant" && typeof message.content === "string"
          && !message.content.includes("（...正在") && Boolean(message.content.trim()));
    const inputsLocked = hasNovelChapters && !manualStateEdit;
    const allowSceneEdit = async () => {
        if (isLoading) return;
        if (!hasNovelChapters || await dialog.confirm(deepText(locale, "novel.ui.overrideAsk"))) {
            setManualStateEdit(true);
        }
    };
    const { currentTrack } = useMusic();
    const lastDrawPromptRef = useRef("");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chars = dbChars && dbChars.length > 0 ? dbChars : CHARACTERS;

    const [dynamicBg, setDynamicBg] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const [drawingIndex, setDrawingIndex] = useState<number | null>(null);
    const confirmNovelDraw = async (index: number) => {
        if (drawingIndex !== null) return;
        if (!useImageGen) { showToast(deepText(locale, "chat.drawDisabled")); return; }
        if (!await dialog.confirm(deepText(locale, "chat.drawConfirm"))) return;
        setDrawingIndex(index);
        try { await onGenerateDraw(index); }
        catch (error) { showToast(`${deepText(locale, "chat.drawFailed")}${error instanceof Error ? error.message : deepText(locale, "chat.unknownError")}`); }
        finally { setDrawingIndex(null); }
    };

    // Cloud image generation goes through the shared onGenerateDraw handler.
    // The legacy browser-to-local-SD endpoint is deliberately removed.

    useEffect(() => {
        const color = '#fdf6e3';

        document.body.style.backgroundColor = color;
        document.documentElement.style.backgroundColor = color;

        return () => {
            document.body.style.backgroundColor = '';
            document.documentElement.style.backgroundColor = '';
        };
    }, []);

    const handleOutlineChange = (val: string) => {
        setOutline(val);
        if (updateSessionInfo) updateSessionInfo(currentSession.id, { localWorldInfo: val });
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [currentSession?.messages, isLoading]);

    const handleGenerate = async (type: 'new' | 'continue', optionText?: string) => {
        if (isLoading) return;
        if (!activeModel.trim()) {
            dialog.notify(deepText(locale, "novel.ui.needModel"));
            return;
        }
        if (!novelWorldline) {
            showToast?.(deepText(locale, "novel.toolbar.worldlineRequired"));
            setWorldlineOpen(true);
            setRightOpen(true);
            return;
        }
        if (novelRole === "participant" && (!novelSelf || (novelSelf.worldId
            && !enabledWorldIds(novelWorldline).includes(novelSelf.worldId)))) {
            showToast?.(deepText(locale, "novel.toolbar.selfWorldMismatch"));
            return;
        }
        const targetNames = chars.filter((c: any) => selectedCharIds.includes(c.id)).map((c: any) => characterDisplayName(c.id, c.name, locale)).join(", ");
        if (!environment.trim() || !event.trim()) {
            showToast?.(deepText(locale, "novel.ui.needState"));
            return;
        }
        const novelConfig = { charNames: targetNames, environment:environment.trim(), event:event.trim(), style, outline, selfId:novelRole === "participant" ? novelSelfId : null };
        saveDraft();

        if (type === 'new') {
            const chapterCount = currentSession.messages.filter((m: any) => m.role === 'assistant' && !m.content.includes("（...正在")).length;

            if (chapterCount > 0) {
                if (await dialog.confirm(deepText(locale, "novel.ui.newDreamAsk"))) {
                    createNewSession(selectedCharIds[0] || "sakiko", 'novel');
                    return;
                } else {
                    return; 
                }
            } else {
                const prompt = `[Action]: Start Chapter 1 based on the [Dream Outline]. Introduce the scene and start the action immediately.`;
                handleSend(prompt, undefined, {
                    novelConfig,
                    modelOverride: activeModel
                });
            }
        }
        else {
            let prompt = "";
            if (optionText) prompt = `[User Choice]: ${optionText}\n[Instruction]: Continue story.`;
            else if (directorInput.trim()) prompt = `[Director Instruction]: ${directorInput}`;
            else prompt = `[SYSTEM]: Continue the novel. Next Chapter.`;

            handleSend(prompt, undefined, {
                novelConfig,
                modelOverride: activeModel
            });
        }

        setDirectorInput("");
        if (isMobile) { setLeftOpen(false); setRightOpen(false); }
    };

    const saveDraft = (patch: Partial<NovelDraft> = {}) => {
        updateSessionInfo?.(currentSession.id, {
            novelDraft: { selectedCharIds, selfId:novelRole === "participant" ? novelSelfId : null, environment, event, style, outline, ...patch, themeMode: "paper" },
            updatedAt: Date.now(),
        });
    };
    const updateNovelRole = (role: "observer" | "participant") => {
        if (isLoading || novelStarted) return;
        if (role === "participant" && !canParticipate) {
            showToast?.(deepText(locale, "novel.ui.needSelf"));
            return;
        }
        const self = role === "participant" ? activeNovelSelf : null;
        updateSessionInfo?.(currentSession.id, {
            storyRole: role,
            storySelfId: self?.id || null,
            storySelfSnapshot: self,
            novelDraft: {
                ...(currentSession.novelDraft || {}),
                selectedCharIds, selfId: self?.id || null, environment, event, style, outline, themeMode: "paper",
            },
            updatedAt: Date.now(),
        });
    };
    const updateWorldline = (next: StoryWorldline) => {
        const changedWorld = currentSession.storyWorldline?.worldId !== next.worldId;
        const allowed = new Set([...CHARACTERS, ...customCharacters].filter(char => storyCastAllowed(char, next)).map(char => char.id));
        const safeSelection = selectedCharIds.filter(id => allowed.has(id));
        if (changedWorld && novelStarted && novelRole === "participant" && novelSelf?.worldId
            && !enabledWorldIds(next).includes(novelSelf.worldId)) {
            showToast?.(deepText(locale, "novel.toolbar.lockedWorld"));
            return;
        }
        if (changedWorld && !novelStarted && novelRole === "participant" && novelSelf?.worldId
            && !enabledWorldIds(next).includes(novelSelf.worldId)) {
            showToast?.(deepText(locale, "novel.toolbar.resetObserver"));
        }
        updateSessionInfo?.(currentSession.id, {
            storyWorldline: next,
            ...(!changedWorld ? {
                storyNextCastIds: safeSelection,
                novelDraft: { ...(currentSession.novelDraft || {}), selectedCharIds: safeSelection },
            } : {}),
            ...(changedWorld ? {
                storyNextCastIds: [], storyAllowCrossWorld: false, sceneCastIds: [],
                ...(!novelStarted && novelRole === "participant" && novelSelf?.worldId && !enabledWorldIds(next).includes(novelSelf.worldId)
                    ? { storyRole: "observer", storySelfId: null, storySelfSnapshot: null } : {}),
                novelDraft: {
                    ...(currentSession.novelDraft || {}), selectedCharIds: [],
                    selfId: novelRole === "participant" && (!novelSelf?.worldId || enabledWorldIds(next).includes(novelSelf.worldId)) ? novelSelfId : null,
                },
            } : {}),
            updatedAt: Date.now(),
        });
        setSelectedCharIds(changedWorld ? [] : safeSelection);
    };
    const updateCast = (ids: string[], allowCrossWorld: boolean) => {
        setSelectedCharIds(ids);
        updateSessionInfo?.(currentSession.id, {
            storyNextCastIds: ids, storyAllowCrossWorld: allowCrossWorld,
            novelDraft: { selectedCharIds: ids, selfId:novelRole === "participant" ? novelSelfId : null, environment, event, style, outline, themeMode: "paper" },
            updatedAt: Date.now(),
        });
    };

    const chapters = currentSession?.messages.map((m: any, i: number) => ({ ...m, realIndex: i })).filter((m: any) => m.role === 'assistant' && !m.content.includes("（...正在")) || [];

    return (
        <div
            className={`fixed inset-0 z-[500] ${theme.bg} ${theme.text} flex overflow-hidden font-serif transition-colors duration-500 h-[100dvh] w-screen overscroll-none`}
            style={{ backgroundColor: '#fdf6e3' }}
        >
            <DanmakuOverlay danmakuList={danmakuEnabled ? currentSession?.lastDanmaku?.slice(0, danmakuCount) : []} />
            <div className="fixed inset-0 z-0 pointer-events-none">
                <AnimatePresence>
                    {(dynamicBg || currentTrack?.cover) && (
                        <motion.div
                            key={dynamicBg || currentTrack?.cover}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.3 }} 
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.5 }}
                            className="absolute inset-[-20px] bg-cover bg-center blur-[50px] scale-110" 
                            style={{ backgroundImage: `url(${dynamicBg || currentTrack?.cover})` }}
                        />
                    )}
                </AnimatePresence>
                <div className="absolute inset-0 bg-[#fff8e8]/65"></div>
            </div>
            <AnimatePresence>
                {leftOpen && (
                    <motion.div
                        key="novel-left-sidebar"
                        initial={isMobile ? { x: "-100%" } : { width: 0, opacity: 0 }}
                        animate={isMobile ? { x: 0 } : { width: 280, opacity: 1 }}
                        exit={isMobile ? { x: "-100%" } : { width: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        className={`
                flex flex-col shrink-0 border-r ${theme.border} ${theme.sidebar}
                ${isMobile
                                ? "fixed inset-y-0 left-0 z-[100] w-[min(85vw,280px)] shadow-[10px_0_30px_rgba(0,0,0,0.5)]" // 手机：加重阴影，覆盖在最上层
                                : "relative z-10 shadow-xl" 
                            }
            `}
                    >
                        <div className="w-full md:w-[280px] h-full flex flex-col">
                            <div className={`
                            border-b ${theme.border} flex items-center justify-between
                            pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 px-6 
                        `}>
                                <div className="flex items-center gap-3 overflow-hidden"><Book className={theme.accent} size={20} /><span className={`font-bold text-lg tracking-widest ${theme.title} truncate`}>{currentSession.title}</span></div>
                                <button onClick={() => setLeftOpen(false)} className={`min-h-10 min-w-10 rounded-lg ${theme.text} hover:${theme.accent}`} aria-label={deepText(locale, "novel.toc")}><X size={18} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
                                <div className={`text-[10px] font-bold ${theme.text} opacity-60 uppercase mb-2`}>{deepText(locale, "novel.toolbar.chapters")}</div>
                                {chapters.map((msg: any, i: number) => {
                                    const match = msg.content.match(/chapter="(.*?)"/);
                                    const title = match ? match[1] : `${deepText(locale, "novel.toolbar.chapterPrefix")}${i + 1}${deepText(locale, "novel.toolbar.chapterSuffix")}`;
                                    return (
                                        <div key={i} className="group relative">
                                            <button className={`w-full text-left p-3 rounded-lg ${theme.hover} transition-all border border-transparent`} onClick={() => document.getElementById(`chapter-${i}`)?.scrollIntoView({ behavior: 'smooth' })}>
                                                <div className={`text-xs ${theme.accent} mb-1 font-mono flex justify-between`}><span>{deepText(locale, "novel.toolbar.chapterPrefix")}{i + 1}{deepText(locale, "novel.toolbar.chapterSuffix")}</span>{i === chapters.length - 1 && <span className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex gap-1"><span onClick={(e) => { e.stopPropagation(); const userIndex = msg.realIndex - 1; deleteMessage?.(userIndex >= 0 && currentSession.messages[userIndex]?.role === "user" ? userIndex : msg.realIndex, userIndex >= 0 && currentSession.messages[userIndex]?.role === "user" ? "user" : "assistant"); }} title={deepText(locale, "novel.toolbar.deleteLatest")} className="opacity-60 hover:opacity-100 hover:text-red-400 cursor-pointer p-1"><Trash2 size={12} /></span></span>}</div>
                                                <div className={`text-sm ${theme.title} font-bold truncate`}>{title}</div>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className={`p-4 border-t ${theme.border}`}><button onClick={onExit} className={`flex items-center gap-2 opacity-60 hover:opacity-100 hover:text-red-400 transition-colors w-full p-2 rounded ${theme.hover} justify-center`}><LogOut size={16} /> <span className="text-xs font-bold">{deepText(locale, "novel.toolbar.backToHub")}</span></button></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={` relative z-10  flex-1 flex flex-col relative min-w-0 ${theme.bg} transition-colors duration-500`}>
                <div className={`
                    grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 border-b ${theme.border} shrink-0
                    pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 h-auto
                    min-h-[3.5rem]
                `}>
                    <div className="justify-self-start">
                        <button type="button" onClick={() => { setLeftOpen(!leftOpen); if (isMobile) setRightOpen(false); }} className={`rounded-lg p-2 transition-colors ${theme.text} ${theme.hover}`} title={deepText(locale, "novel.toc")} aria-label={deepText(locale, "novel.toc")}><AlignLeft size={19} /></button>
                    </div>
                    <h1 className={`whitespace-nowrap text-sm font-semibold tracking-[0.24em] sm:text-base ${theme.title}`}>TELA</h1>
                    <div className="flex items-center justify-self-end gap-0.5 sm:gap-1">
                        <button type="button" onClick={() => setShowMemoryVault(true)}
                            title={`TELA · ${deepText(locale, "novel.ui.memory")}`} aria-label={deepText(locale, "novel.ui.memoryOpen")}
                            className="flex items-center gap-1.5 rounded-lg border border-[#d8c29c] bg-[#fff8e7] px-2 py-1.5 text-[#865e35] shadow-sm transition hover:bg-[#f3e4c8]">
                            <Brain size={17}/><span className="hidden text-[10px] font-semibold sm:inline">{deepText(locale, "novel.ui.memory")}</span>
                            <span className="rounded bg-[#f1e2c7] px-1.5 text-[10px] font-mono">{parseLocalMemoryEntries(currentSession.stm).length}/{parseLocalMemoryEntries(currentSession.ltm).length}</span>
                        </button>
                        <button type="button" onClick={onOpenSettings} className={`rounded-lg p-2 transition-colors ${theme.text} ${theme.hover}`} title={`Shiorivia · ${deepText(locale, "common.settings")}`} aria-label={deepText(locale, "common.settings")}><Settings2 size={19} /></button>
                        <button type="button" onClick={() => { setRightOpen(!rightOpen); if (isMobile) setLeftOpen(false); }} className={`rounded-lg p-2 transition-colors ${theme.text} ${theme.hover}`} title={deepText(locale, "novel.ui.sidebarOpen")} aria-label={deepText(locale, "novel.ui.sidebarOpen")}><PanelRight size={19} /></button>
                    </div>
                </div>

                <div className="z-10"><MiniPlayer onExpand={() => setShowFullPlayer(true)} rightSidebarOpen={rightOpen} themeMode="paper" /></div>
                <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />

                <div className="flex-1 overflow-y-auto p-6 md:p-16 scroll-smooth pb-32">
                    <div className="max-w-3xl mx-auto space-y-16">
                        {chapters.map((msg: any, i: number) => {
                            const cleanContent = stripNovelState(msg.content).replace(/<meta.*?\/>/, '').trim();
                            const match = msg.content.match(/chapter="(.*?)"/);
                            const title = match ? match[1] : `${deepText(locale, "novel.toolbar.chapterPrefix")}${i + 1}${deepText(locale, "novel.toolbar.chapterSuffix")}`;
                            return (
                                <div key={i} id={`chapter-${i}`} className="animate-fade-in-up">
                                    <div className="flex items-center gap-4 mb-8 opacity-30 justify-center"><div className={`h-px ${theme.text} w-12`}></div><span className="font-mono text-xs tracking-widest uppercase">{title}</span><div className={`h-px ${theme.text} w-12`}></div></div>
                                    <div className={`prose ${theme.prose} prose-lg md:prose-xl leading-loose ${theme.text} font-serif whitespace-pre-wrap`}>
                                        <NovelContent content={msg.content} suggestionsOverride={msg.novelChoices}
                                            onOptionClick={(opt: string) => { void confirmNovelSuggestion(opt, "send"); }}
                                            onOptionInsert={(opt: string) => { void confirmNovelSuggestion(opt, "insert"); }}
                                            onImageOpen={setPreviewImage} theme={theme} selfColors={selfColors} locale={locale}
                                            disabled={isLoading || i !== chapters.length - 1} />

                                        {msg.metadataRepairMissing && i === chapters.length - 1 && (
                                            <div role="status" className="my-5 flex items-center gap-3 rounded-xl border border-[#dfc29a] bg-[#fff8e9] p-3 text-xs text-[#735439]">
                                                <AlertTriangle size={16} className="shrink-0"/>
                                                <span className="flex-1">{deepText(locale, "novel.ui.incomplete")}</span>
                                                <button type="button" disabled={isLoading || metadataRepairing}
                                                    onClick={() => onCompleteMissingMetadata?.(msg.realIndex)}
                                                    className="rounded-lg border border-[#d9c39d] bg-white px-3 py-1.5 font-semibold disabled:opacity-40">
                                                    {metadataRepairing ? deepText(locale, "novel.ui.repairing") : deepText(locale, "novel.ui.repair")}
                                                </button>
                                            </div>
                                        )}
                                        {useImageGen && parseDrawTag(msg.content)?.trigger && (
                                            <button type="button" disabled={drawingIndex !== null || isLoading}
                                                onClick={() => void confirmNovelDraw(msg.realIndex)}
                                                className="mt-5 flex w-full items-center gap-3 rounded-xl border border-[#d9bd91] bg-[#fff4de] px-4 py-3 text-left font-serif text-xs text-[#6f5637] shadow-[0_4px_18px_rgba(117,88,48,.09)] transition hover:border-[#b28b59] hover:bg-[#f8e9ce] disabled:opacity-50">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#dbc6a1] bg-[#f2e3c7] text-[#9b784a]"><Sparkles size={17}/></span>
                                                <span className="min-w-0 flex-1"><span className="block font-sans text-[9px] font-bold tracking-[0.15em] text-[#a4875c]">TELA · CHAPTER ILLUSTRATION</span><span className="mt-1 block text-sm font-semibold">{deepText(locale, "novel.ui.drawChapter")}</span></span>
                                                <span className="ml-auto shrink-0 font-sans text-[11px] text-[#977750]">{drawingIndex === msg.realIndex ? deepText(locale, "novel.ui.generating") : deepText(locale, "novel.ui.clickGenerate")}</span>
                                            </button>
                                        )}
                                        {debugMode && (msg.content.includes('<draw>') || msg.content.includes('<draw_log>')) && (
                                            <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#18232f] p-3 text-left font-mono text-[11px] text-[#d7e7df]">
                                                {JSON.stringify({ instruction: msg.content.match(/<(?:draw|draw_log)>([\s\S]*?)<\/(?:draw|draw_log)>/)?.[1], request: buildDrawRequest(msg.content.replaceAll('<draw_log>', '<draw>').replaceAll('</draw_log>', '</draw>'), { activeCharacterId: selectedCharIds[0] || currentSession.characterId, characters: chars, charStatus: currentSession.charStatus, settings: imageSettings }) }, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {isLoading && <div className="flex justify-center py-10"><Sparkles className={`animate-spin ${theme.accent}`} size={32} /></div>}
                        <div ref={messagesEndRef} className="h-10"></div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#fdf6e3] via-[#fdf6e3] to-transparent p-4 pb-6 z-20">
                    <div className="max-w-2xl mx-auto">
                        {!novelWorldline && <div role="status" className={`mb-3 flex items-center justify-between gap-3 rounded-xl border ${theme.border} ${theme.inputBg} px-3 py-2 text-xs ${theme.text}`}>
                            <span>{deepText(locale, "novel.ui.needWorldline")}</span>
                            <button type="button" onClick={() => { setRightOpen(true); setWorldlineOpen(true); }} className={`shrink-0 rounded-lg border ${theme.border} px-3 py-1.5 font-semibold ${theme.hover}`}>{deepText(locale, "novel.ui.setWorldline")}</button>
                        </div>}
                        <div className="flex items-end gap-2">
                        <button onClick={() => { const lastAssistIdx = currentSession.messages.map((m: any, i: number) => ({ ...m, i })).filter((m: any) => m.role === 'assistant').pop()?.i; if (lastAssistIdx) handleRegenerate(lastAssistIdx); }} disabled={isLoading || !novelWorldline} className={`p-3 mb-1 rounded-full ${theme.inputBg} backdrop-blur border ${theme.border} opacity-60 hover:opacity-100 hover:text-red-400 transition-all shadow-lg ${theme.subButton}`}><RefreshCw size={18} className={isLoading ? "animate-spin" : ""} /></button>

                        <div className={`flex-1 ${theme.inputBg} backdrop-blur-md border ${theme.border} rounded-2xl flex items-center p-2 shadow-2xl transition-all`}>
                            <input value={directorInput} onChange={(e) => setDirectorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isLoading && novelWorldline && handleGenerate('continue')} placeholder={novelWorldline ? deepText(locale, "novel.director") : deepText(locale, "novel.toolbar.worldlineFirst")} className={`flex-1 bg-transparent border-none outline-none text-sm ${theme.title} px-3 font-sans ${theme.placeholder} disabled:cursor-not-allowed disabled:opacity-60`} disabled={isLoading || !novelWorldline} />

                            {isLoading ? (
                                <button
                                    onClick={() => void confirmStopGeneration()}
                                    className={`p-2 rounded-xl transition-all shadow-lg bg-red-600 text-white hover:bg-red-500 animate-pulse`}
                                    title={deepText(locale, "common.stop")}
                                >
                                    <Square size={18} fill="currentColor" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleGenerate('continue')}
                                    disabled={!novelWorldline}
                                    className={`p-2 rounded-xl transition-all shadow-lg ${theme.button} disabled:cursor-not-allowed disabled:opacity-40`}
                                    title="Continue"
                                >
                                    <ArrowUp size={18} />
                                </button>
                            )}

                        </div>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {rightOpen && (
                    <motion.div
                        key="novel-right-sidebar"
                        initial={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
                        animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
                        exit={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        className={`
                flex flex-col shrink-0 border-l ${theme.border} ${theme.sidebar}
                ${isMobile
                                ? "fixed inset-y-0 right-0 z-[100] w-[min(88vw,320px)] shadow-[-10px_0_30px_rgba(0,0,0,0.5)]" // 手机：覆盖层
                                : "relative z-10 shadow-xl"
                            }
                md:pt-0
            `}
                    >
                        <div className="w-full md:w-[320px] h-full flex flex-col">
                            <div className={`
                            border-b ${theme.border} flex justify-between items-center
                            pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 px-6
                        `}>
                                <div><div className={`text-[10px] font-bold ${theme.text} opacity-50 uppercase tracking-widest mb-1`}>TELA · CREATION</div><h2 className={`text-xl font-serif ${theme.title}`}>{deepText(locale, "novel.controls")}</h2></div>{isMobile && <button onClick={() => setRightOpen(false)} className={`min-h-10 min-w-10 rounded-lg ${theme.text} hover:${theme.accent}`} aria-label={deepText(locale, "novel.ui.sidebarOpen")}><X /></button>}</div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">

                                <div>
                                    <label className={`text-xs ${theme.accent} font-bold mb-2 block flex items-center gap-2`}><FileText size={14} /> SESSION SETTING · {deepText(locale, "novel.outline")}</label>
                                    <textarea
                                        value={outline}
                                        onChange={e => handleOutlineChange(e.target.value)}
                                        onBlur={() => saveDraft()}
                                        placeholder={deepText(locale, "novel.outlinePlaceholder")}
                                        className={`w-full h-32 ${theme.inputBg} border ${theme.border} rounded p-3 text-xs ${theme.text} ${theme.focus} outline-none resize-none font-mono ${theme.placeholder}`}
                                    />
                                </div>

                                <div className={`${theme.inputBg} p-4 rounded-2xl border ${theme.border} space-y-5 shadow-sm`}>

                                    <div className="space-y-2">
                                        <label className={`text-[10px] ${theme.text} opacity-50 font-black uppercase tracking-widest mb-2 block`}>AI Architect · Shared Model</label>
                                        <select aria-label={deepText(locale, "novel.provider")} value={provider || ""} onChange={e => onProviderChange(e.target.value)} className={`w-full ${theme.bg} border ${theme.border} rounded-lg px-3 py-2 text-xs ${theme.text} outline-none ${theme.focus}`}>
                                            {providers.map((p: PublicLocalProvider) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                            {!providers.some((p: PublicLocalProvider) => p.id === provider) && <option value={provider}>{provider || deepText(locale, "novel.unconfigured")}</option>}
                                        </select>
                                        <select aria-label={deepText(locale, "novel.model")} value={customModelId && savedIds.includes(customModelId) ? `saved:${customModelId}` : (!customModelId && !provider.startsWith("custom_") && availableModels.some(m => m.id === selectedModel) ? selectedModel : "")} onChange={e => e.target.value.startsWith("saved:") ? onCustomModelChange(e.target.value.slice(6)) : onModelChange(e.target.value)} className={`w-full ${theme.bg} border ${theme.border} rounded-lg px-3 py-2 text-xs ${theme.text} outline-none ${theme.focus}`}>
                                            <option value="">{deepText(locale, "novel.manual")}</option>
                                            {!provider.startsWith("custom_") && availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            {savedIds.map(id => <option key={`saved:${id}`} value={`saved:${id}`}>{id} · {deepText(locale, "novel.toolbar.custom")}</option>)}
                                        </select>
                                        <div className="flex gap-2">
                                            <input aria-label={deepText(locale, "novel.toolbar.modelId")} value={customModelId || ""} onChange={e => onCustomModelChange(e.target.value)} placeholder={deepText(locale, "novel.toolbar.modelIdOptional")} className={`min-w-0 flex-1 ${theme.inputBg} border ${theme.border} rounded-lg px-3 py-2 text-xs ${theme.text} outline-none ${theme.focus}`} />
                                            <button type="button" onClick={() => saveModel(provider, customModelId || "")} disabled={!customModelId?.trim() || savedIds.includes(customModelId.trim())} className="rounded-lg border border-[#bda77c] px-3 text-xs text-[#a48b5c] disabled:opacity-40">{deepText(locale, "common.save")}</button>
                                        </div>
                                        {savedIds.length > 0 && <div className="flex flex-wrap gap-2">{savedIds.map(id => <span key={id} className={`inline-flex items-center gap-1 rounded-lg border ${theme.border} px-2 py-1 text-[10px] ${theme.text}`}><button type="button" onClick={() => onCustomModelChange(id)}>{id} · {deepText(locale, "novel.toolbar.custom")}</button><button type="button" onClick={() => forgetModel(provider, id)} aria-label={`${deepText(locale, "novel.toolbar.removeModel")} ${id}`} className="ml-1 opacity-60 hover:opacity-100">×</button></span>)}</div>}
                                        <p className={`text-[10px] ${theme.text} opacity-50`}>{deepText(locale, "novel.current")}：{activeModel || deepText(locale, "novel.manual")} · {deepText(locale, "novel.sync")}</p>
                                    </div>

                                    <div>
                                        <button
                                            onClick={onManualSync}
                                            disabled={syncStatus === 'syncing'}
                                            className={`
                                            w-full py-2.5 rounded-xl text-[11px] font-black tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.97]
                                                ${syncStatus === 'syncing'
                                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 cursor-wait'
                                                    : syncStatus === 'error'
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        : syncStatus === 'success'
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : `${theme.subButton} border border-transparent hover:border-purple-500/30`}
                                            `}
                                        >
                                            {syncStatus === 'syncing' ? <RefreshCw size={14} className="animate-spin" /> :
                                                syncStatus === 'success' ? <Check size={14} /> :
                                                    syncStatus === 'error' ? <AlertTriangle size={14} /> :
                                                        <HardDrive size={14} />}

                                            <span>{syncStatus === "syncing" ? localText(locale, "sync.syncing") : syncStatus === "success" ? localText(locale, "sync.saved") : syncStatus === "error" ? localText(locale, "sync.failed") : localText(locale, "sync.now")}</span>
                                        </button>

                                        <p className={`text-[9px] text-center mt-2 ${theme.text} opacity-30 font-mono italic`}>
                                            {syncStatus === "syncing" ? localText(locale, "sync.syncing") : localText(locale, "novel.ready")}
                                        </p>
                                    </div>
                                </div>

                                <NovelArchiveActions
                                    session={currentSession}
                                    draft={{ selectedCharIds, selfId:novelRole === "participant" ? novelSelfId : null, environment, event, style, outline, themeMode: "paper" }}
                                    onImport={onImportNovelSession}
                                    disabled={isLoading}
                                    className="rounded-2xl border-2 border-[#c5a97a] bg-[#fffaf0] p-4 text-[#67533a] shadow-[0_6px_22px_rgba(121,89,45,.12)]"
                                />

                                <section className={`space-y-3 rounded-2xl border ${theme.border} ${theme.inputBg} p-4 shadow-sm`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-xs font-bold ${theme.accent}`}>{deepText(locale, "novel.ui.worldline")} · WORLDLINE</span>
                                        <span className={`text-[10px] ${theme.text} opacity-60`}>{deepText(locale, "novel.ui.background")}</span>
                                    </div>
                                    <p className={`text-[11px] leading-5 ${theme.text}`}>
                                        {novelWorldline ? describeStoryWorldline({ ...novelWorldline, event:"" }, locale) : deepText(locale, "novel.ui.worldlineMissing")}
                                    </p>
                                    <button type="button" onClick={() => setWorldlineOpen(true)} disabled={isLoading}
                                        className={`w-full rounded-xl border ${theme.border} px-3 py-2 text-xs font-semibold transition ${theme.hover} disabled:opacity-50`}>
                                        {novelWorldline ? deepText(locale, "novel.ui.editWorldline") : deepText(locale, "novel.ui.createWorldline")}
                                    </button>
                                </section>
                                <StoryCastPicker session={currentSession} worlds={storyWorlds}
                                    customCharacters={customCharacters} busy={isLoading}
                                    onApply={updateCast} mode="novel" tone="paper" />
                                <section className={`rounded-2xl border ${theme.border} ${theme.inputBg} p-4 space-y-3`}>
                                    <div className={`text-xs font-bold ${theme.accent}`}>{deepText(locale, "novel.ui.role")} · STORY ROLE</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <button type="button" disabled={isLoading || novelStarted}
                                            aria-pressed={novelRole === "observer"}
                                            onClick={() => updateNovelRole("observer")}
                                            className={`rounded-xl border p-2.5 ${novelRole === "observer" ? theme.selectBorder + " " + theme.selectBg : theme.border} disabled:opacity-55`}>{deepText(locale, "novel.ui.observer")}</button>
                                        <button type="button" disabled={isLoading || novelStarted || !canParticipate}
                                            aria-pressed={novelRole === "participant"}
                                            title={!canParticipate ? deepText(locale, "novel.ui.selfRequired") : ""}
                                            onClick={() => updateNovelRole("participant")}
                                            className={`rounded-xl border p-2.5 ${novelRole === "participant" ? theme.selectBorder + " " + theme.selectBg : theme.border} disabled:opacity-55`}>{deepText(locale, "novel.ui.participant")}</button>
                                    </div>
                                    {novelRole === "participant"
                                        ? <p className={`text-[11px] leading-5 ${theme.text}`}>{deepText(locale, "novel.ui.usingSelf")}<span className="font-semibold" style={{ color: novelSelf?.hex || "#799783" }}>{novelSelf ? selfName(novelSelf, locale) : deepText(locale, "novel.ui.selfUnavailable")}</span></p>
                                        : <p className={`text-[11px] leading-5 ${theme.text} opacity-65`}>{deepText(locale, "novel.ui.observeHelp")}</p>}
                                    {novelStarted && <p className={`text-[10px] ${theme.text} opacity-60`}>{deepText(locale, "novel.ui.roleLocked")}</p>}
                                </section>


                                <div><label className={`text-xs ${theme.text} opacity-70 font-bold mb-2 block uppercase`}>Quick Presets · {deepText(locale, "novel.ui.presets")}</label><div className="grid grid-cols-2 gap-2">{localizedPresets.map((p, i) => (<button key={i} type="button" disabled={isLoading || inputsLocked} onClick={() => { setEnvironment(p.environment); setEvent(p.event); setStyle(p.style); saveDraft({ environment:p.environment, event:p.event, style:p.style }); }} className={`px-3 py-2.5 rounded-xl text-left ${theme.inputBg} border ${theme.border} text-[11px] ${theme.text} hover:shadow-sm transition-all`}>{p.name}</button>))}</div></div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-[10px] ${theme.text} opacity-75`}>{hasNovelChapters ? deepText(locale, "novel.ui.aiUpdates") : deepText(locale, "novel.ui.firstChapter")}</span>
                                        {inputsLocked && <button type="button" onClick={allowSceneEdit} className={`shrink-0 rounded-lg border ${theme.border} px-2 py-1 text-[10px] font-semibold ${theme.hover}`}>{deepText(locale, "novel.ui.unlockEdit")}</button>}
                                        {manualStateEdit && <button type="button" disabled={isLoading || !environment.trim() || !event.trim()}
                                            onClick={() => { saveDraft(); setManualStateEdit(false); showToast?.(deepText(locale, "novel.ui.savedLock")); }}
                                            className={`shrink-0 rounded-lg border ${theme.selectBorder} ${theme.selectBg} px-3 py-1 text-[10px] font-semibold ${theme.title} disabled:opacity-40`}>{deepText(locale, "novel.ui.saveLock")}</button>}
                                    </div>
                                    <div><label className={`text-xs ${theme.text} opacity-80 font-bold mb-1 block`}>Environment · {deepText(locale, "novel.ui.environment")} *</label><textarea required value={environment} readOnly={inputsLocked} onChange={e => setEnvironment(e.target.value)} onBlur={() => saveDraft()} placeholder={deepText(locale, "novel.ui.environmentHint")} className={`w-full h-20 ${theme.inputBg} border ${theme.border} rounded p-2 text-xs ${theme.text} ${theme.focus} outline-none resize-y read-only:opacity-65`} /></div>
                                    <div><label className={`text-xs ${theme.text} opacity-80 font-bold mb-1 block`}>Event · {deepText(locale, "novel.ui.event")} *</label><textarea required value={event} readOnly={inputsLocked} onChange={e => setEvent(e.target.value)} onBlur={() => saveDraft()} placeholder={deepText(locale, "novel.ui.eventHint")} className={`w-full h-20 ${theme.inputBg} border ${theme.border} rounded p-2 text-xs ${theme.text} ${theme.focus} outline-none resize-y read-only:opacity-65`} /></div>
                                    <div><label className={`text-xs ${theme.text} opacity-70 font-bold mb-1 block`}>Style</label><input value={style} onChange={e => setStyle(e.target.value)} onBlur={() => saveDraft()} placeholder={deepText(locale, "novel.ui.styleHint")} className={`w-full ${theme.inputBg} border ${theme.border} rounded p-2 text-xs ${theme.text} ${theme.focus} outline-none`} /></div>
                                </div>

                                <button onClick={() => handleGenerate('new')} disabled={isLoading || !novelWorldline} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg ${theme.button}`}><Sparkles size={16} /> {deepText(locale, "novel.ui.newChapter")}</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <StoryWorldlineFateModal tone="novel" elevated isOpen={worldlineOpen}
                value={novelWorldline ? { ...novelWorldline, event:"" } : undefined}
                worlds={storyWorlds}
                onSave={updateWorldline}
                showEvent={false}
                onClose={() => setWorldlineOpen(false)}
                onOpenCharta={onOpenCharta}
            />
            {/* Mobile Overlay Mask */}
            {(leftOpen || rightOpen) && isMobile && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm"
                    onClick={() => { setLeftOpen(false); setRightOpen(false) }}
                />
            )}
            <MemoryVaultModal
                open={showMemoryVault}
                onClose={() => setShowMemoryVault(false)}
                sessionId={currentSession.id}
                stm={currentSession.stm}
                ltm={currentSession.ltm}
                tone="novel-paper"
                onSave={({ stm, ltm }) => updateSessionInfo(currentSession.id, {
                    stm, ltm, turnCount: stm.split(/\n/).filter(Boolean).length, updatedAt: Date.now(),
                })}
            />
            <div className="z-[200]">
                <MusicPlayerModal isOpen={showFullPlayer} onClose={() => setShowFullPlayer(false)} />
            </div>
        </div>
    );
};