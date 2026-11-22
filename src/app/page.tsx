"use client";

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { CHARACTERS, Session, type NovelDraft } from "../types";
import { CHAR_DATA } from "../data/char_config";
import LOCAL_LIVE2D_CONFIG from "../data/live2d_config.json";
import { WorldInfoModal, EditModal } from "../components/Modals";
import { SidebarLeft } from "../components/SidebarLeft";
import { SidebarRight } from "../components/SidebarRight";
import { DanmakuOverlay } from "../components/DanmakuOverlay";
import { ChatInterface } from "../components/ChatInterface";
import { Background } from "../components/Background";
import { TransitionEffects } from "../components/TransitionEffects";
import { SaveLoadModal } from "../components/SaveLoadModal";
import { SyncConflictModal } from "../components/SyncConflictModal";
import { CodeRepositoryModal } from "../components/CodeRepositoryPanel";
import { TachieStage } from "../components/TachieStage";
import { NovelInterface } from "../components/NovelInterface";
import { ViaeInterface } from "../components/ViaeInterface";
import { MemoryVaultModal } from "../components/MemoryVaultModal";
import { ModeHub } from "../components/ModeHub";
import { SettingsCenter, type SettingKey, type StoryTheme } from "../components/SettingsCenter";
import { DEFAULT_LOCAL_PROVIDERS, getVisibleLocalProviders, type PublicLocalProvider } from "../lib/localProviders";
import { modelSelectionFor, parseProviderModelSelections, selectProviderModel, type ProviderModelSelections } from "../lib/providerModelSelection";
import { DEFAULT_CONTEXT_WINDOW_TOKENS, normalizeContextWindowTokens } from "../lib/contextWindow";

import { useMusic } from "../context/MusicContext";
import { useLocalFileSync } from "../hooks/useLocalFileSync";
import { DEFAULT_SYNC_PREFERENCES, readLocalSyncPreferences } from "../lib/localSyncPreferences";
import { DEFAULT_IMAGE_SETTINGS, capabilityFor, type ImageSettings, type ProviderCapability } from "../lib/imageSettings";
import { DEFAULT_WEB_TOOL_CONFIG, normalizeWebToolConfig, normalizeProviderAliases, type WebToolConfig } from "../lib/webToolSettings";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import { browserRead, browserWrite, browserDelete, browserMutate } from "../lib/browserStore";
import { createCredentialVault, encryptCredentialVault, isCredentialVaultRecord, unlockCredentialVault } from "../lib/cloudCredentialVault";
import { safeCloudCredentials, type CloudCredentials, type CloudCredential } from "../lib/cloudCredentials";
import { defaultSessionTitle, sessionGreeting, officinaUnassignedWelcome, umbraUnassignedWelcome } from "../lib/sessionTitles";
import { isEngineeringCharacterLocked } from "../lib/engineeringSession";
import { canExtendWorldline } from "../lib/worldlineLock";
import { storyCastAllowed } from "../lib/storyCast";
import { characterDisplayName } from "../lib/characterNames";
import { useChatEngine } from "../hooks/useChatEngine";
import { useChartaSelves } from "../hooks/useChartaSelves";
import { useChartaWorlds } from "../hooks/useChartaWorlds";
import { useChartaCharacters } from "../hooks/useChartaCharacters";
import { toChartaCharConfig, nameForCharta } from "../lib/charta";
import { ChartaInterface } from "../components/ChartaInterface";
import { StaticPortraitStage } from "../components/StaticPortraitStage";
import { useUI } from "../hooks/useUI";
import { useFileHandler } from "../hooks/useFileHandler";
import { useAppDialog, type DialogTone } from "../context/DialogContext";

const Live2DStage = dynamic(() => import("../components/Live2DStage").then(m => m.Live2DStage), { ssr: false });

export default function Home() {
    const { locale } = useLanguage();
    const dialog = useAppDialog();
    const [currentSessionId, setCurrentSessionId] = useState<string>("");
    const [activeCharacterId, setActiveCharacterId] = useState("sakiko");
    const [voiceVariant, setVoiceVariant] = useState("black");
    const [manualOutfitId, setManualOutfitId] = useState<string | undefined>(undefined);
    const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState("");
    const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [playingIndex, setPlayingIndex] = useState<number | null>(null); 
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const ui = useUI();
    const handleEffectComplete = useCallback(() => ui.setEffect("none"), [ui.setEffect]);
    const [showModeHub, setShowModeHub] = useState(true);
    const [showCharta, setShowCharta] = useState(false);
    const [showSettingsCenter, setShowSettingsCenter] = useState(false);
    const [curtainCycle, setCurtainCycle] = useState(0);
    const [showMemoryVault, setShowMemoryVault] = useState(false);
    const [worldlineOpenSignal, setWorldlineOpenSignal] = useState(0);
    const [chatWorldlineOpenSignal, setChatWorldlineOpenSignal] = useState(0);

    useEffect(() => {
        if (process.env.NEXT_PUBLIC_ENABLE_LOCAL_LIVE2D !== "true") return;
        console.log("🔍 [Page Debug] Current Char:", activeCharacterId);
        console.log("🔍 [Page Debug] Live2D Config:", LOCAL_LIVE2D_CONFIG);
        
        const config = (LOCAL_LIVE2D_CONFIG as any)[activeCharacterId];
        console.log("🔍 [Page Debug] Effective Config:", config);
        
        if (!config) console.warn("⚠️ Config is missing! Live2DStage will NOT render.");
    }, [activeCharacterId]);

    const [syncPreferences, setSyncPreferences] = useState(DEFAULT_SYNC_PREFERENCES);
    useEffect(() => { setSyncPreferences(readLocalSyncPreferences()); }, []);
    const updateSyncPreferences = (next: typeof syncPreferences) => {
        setSyncPreferences(next);
        try { localStorage.setItem("shiorivia_sync_preferences_v1", JSON.stringify(next)); } catch {}
    };
    const cloud = useLocalFileSync(isGlobalGenerating, ui.showToast, syncPreferences);
    const selfLibrary = useChartaSelves();
    const worldLibrary = useChartaWorlds();
    const [chartaInitialSection, setChartaInitialSection] = useState<"characters" | "self" | "worlds">("characters");
    const charta = useChartaCharacters();
    const allChars = useMemo(() => [...CHAR_DATA, ...charta.characters.map(char => toChartaCharConfig(char, locale))], [charta.characters, locale]);

    const music = useMusic();

    const [config, setConfig] = useState({
        webSearch: false,
        webToolConfig: DEFAULT_WEB_TOOL_CONFIG,
        imageGen: false,
        danmakuEnabled: false,
        danmakuCount: 8,
        debugDrawTags: false,
        tts: false,
        musicControl: false,
        terminalRequestLog: false,
        terminalLog: false,
        engineeringTransition: false,
        curtainTransition: true,
        geminiNarrativeStyle: false,
        engineeringLoreRelationships: false,
        engineeringLoreExperiences: false,
        contextWindowTokens: DEFAULT_CONTEXT_WINDOW_TOKENS,
        storyTheme: "sky" as StoryTheme,
        imageSettings: DEFAULT_IMAGE_SETTINGS,
        selectedModel: "",
        customModelId: "",
        expandedGroups: ["Gemini (Google)"] as string[]
    });

    const [apiProvider, setApiProvider] = useState<string>('');
    const [providerModels, setProviderModels] = useState<ProviderModelSelections>({});
    const [settingsHydrated, setSettingsHydrated] = useState(false);
    const [disabledProviders, setDisabledProviders] = useState<string[]>([]);
    const [providerCapabilities, setProviderCapabilities] = useState<Record<string, ProviderCapability>>({});
    const [providerAliases, setProviderAliases] = useState<Record<string, string>>({});
    const [falConfigured, setFalConfigured] = useState(false);
    // Stored vault/editor and decrypted runtime credentials are independent.
    // Only cloudCredentials is passed to model providers; vaultDraft is never used for API requests.
    const [cloudCredentials, setCloudCredentials] = useState<CloudCredentials>({});
    const [vaultDraft, setVaultDraft] = useState<CloudCredentials>({});
    const [vaultStatus, setVaultStatus] = useState<"loading" | "setup" | "migrate" | "editing" | "locked" | "error">("loading");
    const [vaultHasSaved, setVaultHasSaved] = useState(false);
    const [runtimeUnlocked, setRuntimeUnlocked] = useState(false);
    const [vaultBusy, setVaultBusy] = useState(false);
    const [vaultError, setVaultError] = useState("");
    const editorKeyRef = useRef<CryptoKey | null>(null);
    const editorSaltRef = useRef("");
    const editorCiphertextRef = useRef("");
    const vaultOperationRef = useRef(false);
    const [allProviders, setAllProviders] = useState<PublicLocalProvider[]>(DEFAULT_LOCAL_PROVIDERS);

    useEffect(() => {
        let mounted = true;
        void browserRead<unknown>("cloud:byok", null).then(saved => {
            if (!mounted) return;
            if (saved === null) {
                setVaultHasSaved(false);
                setVaultStatus("setup");
            } else if (isCredentialVaultRecord(saved)) {
                setVaultHasSaved(true);
                setVaultStatus("locked");
            } else if (typeof saved === "object" && !Array.isArray(saved)) {
                // Migration is explicitly saved as encrypted data before any provider use.
                setVaultDraft(safeCloudCredentials(saved));
                setVaultHasSaved(false);
                setVaultStatus("migrate");
            } else {
                setVaultStatus("error");
                setVaultError(deepText(locale, "cloud.vault.corrupt"));
            }
        }).catch(() => {
            if (!mounted) return;
            setVaultStatus("error");
            setVaultError(deepText(locale, "cloud.byok.storageError"));
        });
        return () => { mounted = false; };
    }, []);

    const clearRuntimeCredentials = () => {
        // Clearing the reference is best-effort; JavaScript engines manage GC.
        setCloudCredentials({});
        setRuntimeUnlocked(false);
    };
    const clearVaultEditor = () => {
        editorKeyRef.current = null;
        editorSaltRef.current = "";
        editorCiphertextRef.current = "";
        setVaultDraft({});
    };
    const submitCloudVault = async (passphrase: string, confirmation: string): Promise<boolean> => {
        if (vaultOperationRef.current || !["setup", "migrate", "editing"].includes(vaultStatus)) return false;
        setVaultError("");
        if (vaultStatus !== "editing" && (passphrase.length < 12 || passphrase !== confirmation)) {
            setVaultError(deepText(locale, passphrase.length < 12 ? "cloud.vault.short" : "cloud.vault.mismatch"));
            return false;
        }
        vaultOperationRef.current = true;
        setVaultBusy(true);
        try {
            const draft = safeCloudCredentials(vaultDraft);
            if (!Object.values(draft).some(entry => entry.apiKey.length > 0)) {
                setVaultError(deepText(locale, "cloud.vault.keyRequired"));
                return false;
            }
            if (vaultStatus === "editing") {
                const key = editorKeyRef.current, salt = editorSaltRef.current;
                if (!key || !salt) throw new Error("Editor is not unlocked.");
                const sealed = await encryptCredentialVault(draft, key, salt);
                await browserMutate<unknown>("cloud:byok", current => {
                    if (!isCredentialVaultRecord(current)
                        || current.salt !== salt || current.ciphertext !== editorCiphertextRef.current) {
                        throw new Error("Vault changed in another browser tab.");
                    }
                    return sealed;
                });
            } else {
                const created = await createCredentialVault(passphrase, draft);
                await browserMutate<unknown>("cloud:byok", current => {
                    if (isCredentialVaultRecord(current)) throw new Error("Vault changed in another browser tab.");
                    if (vaultStatus === "setup" && current !== undefined) throw new Error("Vault changed in another browser tab.");
                    return created.record;
                });
            }
            clearVaultEditor();
            clearRuntimeCredentials();
            setVaultHasSaved(true);
            setVaultStatus("locked");
            return true;
        } catch (error) {
            const conflict = error instanceof Error && error.message.includes("Vault changed");
            setVaultError(deepText(locale, conflict ? "cloud.vault.conflict" : "cloud.byok.storageError"));
            return false;
        } finally {
            vaultOperationRef.current = false;
            setVaultBusy(false);
        }
    };
    const startVaultEditor = async (passphrase: string): Promise<boolean> => {
        if (vaultOperationRef.current || vaultStatus !== "locked" || !vaultHasSaved) return false;
        vaultOperationRef.current = true;
        setVaultBusy(true);
        setVaultError("");
        try {
            const saved = await browserRead<unknown>("cloud:byok", null);
            if (!isCredentialVaultRecord(saved)) throw new Error("Vault record missing.");
            const unlocked = await unlockCredentialVault(saved, passphrase);
            editorKeyRef.current = unlocked.key;
            editorSaltRef.current = saved.salt;
            editorCiphertextRef.current = saved.ciphertext;
            setVaultDraft(unlocked.credentials);
            clearRuntimeCredentials();
            setVaultStatus("editing");
            return true;
        } catch {
            setVaultError(deepText(locale, "cloud.vault.unlockFailed"));
            return false;
        } finally {
            vaultOperationRef.current = false;
            setVaultBusy(false);
        }
    };
    const cancelVaultEditor = () => {
        if (vaultStatus !== "editing" || vaultBusy) return;
        clearVaultEditor();
        setVaultStatus("locked");
        setVaultError("");
    };
    const decryptVaultForUse = async (passphrase: string): Promise<boolean> => {
        if (vaultOperationRef.current || !vaultHasSaved || vaultStatus === "editing") return false;
        vaultOperationRef.current = true;
        setVaultBusy(true);
        setVaultError("");
        try {
            const saved = await browserRead<unknown>("cloud:byok", null);
            if (!isCredentialVaultRecord(saved)) throw new Error("Vault record missing.");
            const { credentials } = await unlockCredentialVault(saved, passphrase);
            setCloudCredentials(credentials);
            setRuntimeUnlocked(true);
            return true;
        } catch {
            clearRuntimeCredentials();
            setVaultError(deepText(locale, "cloud.vault.unlockFailed"));
            return false;
        } finally {
            vaultOperationRef.current = false;
            setVaultBusy(false);
        }
    };
    const resetCloudVault = async () => {
        if (vaultOperationRef.current) return;
        if (!await dialog.confirm(deepText(locale, "cloud.vault.resetConfirm"), { tone: "officina" })) return;
        if (vaultOperationRef.current) return;
        vaultOperationRef.current = true;
        setVaultBusy(true);
        try {
            await browserDelete("cloud:byok");
            clearVaultEditor();
            clearRuntimeCredentials();
            setVaultHasSaved(false);
            setVaultStatus("setup");
            setVaultError("");
        } catch {
            setVaultError(deepText(locale, "cloud.byok.storageError"));
        } finally {
            vaultOperationRef.current = false;
            setVaultBusy(false);
        }
    };
    const updateCloudCredential = async (id: string, next: CloudCredential) => {
        if (!["setup", "migrate", "editing"].includes(vaultStatus) || vaultBusy) return;
        setVaultDraft(current => safeCloudCredentials({ ...current, [id]: next }));
    };
    useEffect(() => {
        const builtins = DEFAULT_LOCAL_PROVIDERS.map(p => ({
            ...p, configured: Boolean(cloudCredentials[p.id]?.apiKey),
        }));
        const custom = ([1,2,3,4] as const).map(n => {
            const id = `custom_${n}`;
            const item = cloudCredentials[id];
            return { id: id as PublicLocalProvider["id"], label: `Custom_${n}`,
                configured: Boolean(item?.apiKey && item?.baseURL), custom: true };
        });
        setAllProviders([...custom,...builtins]);
    }, [cloudCredentials]);
    useEffect(() => {
        try {
            const raw = window.localStorage.getItem("shiorivia_local_preferences_v1");
            const saved = raw ? JSON.parse(raw) : null;
            if (saved && typeof saved === "object") {
                if (Array.isArray(saved.disabledProviders)) setDisabledProviders(saved.disabledProviders.filter((x: unknown) => typeof x === "string"));
                setProviderAliases(normalizeProviderAliases(saved.providerAliases));
                const restoredProvider = typeof saved.apiProvider === "string" ? saved.apiProvider : "";
                if (typeof saved.apiProvider === "string") setApiProvider(saved.apiProvider);
                const restoredModels = parseProviderModelSelections(saved.providerModels);
                setProviderModels(restoredModels);
                if (saved.providerCapabilities && typeof saved.providerCapabilities === "object") {
                    const caps: Record<string, ProviderCapability> = {};
                    for (const [id, entry] of Object.entries(saved.providerCapabilities as Record<string, any>)) {
                        if (/^custom_[1-4]$/.test(id)) caps[id] = { llm: entry?.llm !== false, image: entry?.image === true };
                    }
                    setProviderCapabilities(caps);
                }
                setConfig(prev => ({
                    ...prev,
                    webSearch: typeof saved.webSearch === "boolean" ? saved.webSearch : prev.webSearch,
                    webToolConfig: normalizeWebToolConfig(saved.webToolConfig),
                    imageGen: false, // re-enable only after Cloud BYOK image model validation
                    danmakuEnabled: saved.danmakuEnabled === true,
                    danmakuCount: Number.isFinite(saved.danmakuCount) ? Math.min(24, Math.max(1, Math.round(saved.danmakuCount))) : 8,
                    debugDrawTags: saved.debugDrawTags === true,
                    imageSettings: saved.imageSettings && typeof saved.imageSettings === "object"
                        ? (() => { const next = { ...DEFAULT_IMAGE_SETTINGS, ...Object.fromEntries(Object.entries(saved.imageSettings).filter(([k]) => k in DEFAULT_IMAGE_SETTINGS)) }; return { ...next, provider: next.provider === "comfyui" ? "" : next.provider }; })()
                        : prev.imageSettings,
                    tts: false, // TTS is under development
                    musicControl: false,
                    terminalRequestLog: false,
                    terminalLog: false,
                    engineeringTransition: typeof saved.engineeringTransition === "boolean" ? saved.engineeringTransition : false,
                    curtainTransition: saved.curtainTransition !== false,
                    geminiNarrativeStyle: saved.geminiNarrativeStyle === true,
                    engineeringLoreRelationships: saved.engineeringLoreRelationships === true,
                    engineeringLoreExperiences: saved.engineeringLoreExperiences === true,
                    contextWindowTokens: normalizeContextWindowTokens(saved.contextWindowTokens),
                    storyTheme: (["sky", "sage", "rose"].includes(saved.storyTheme) ? saved.storyTheme : prev.storyTheme) as StoryTheme,
                    ...modelSelectionFor(restoredModels, restoredProvider),
                }));
            }
        } catch {
            // Invalid or unavailable browser storage should not block Local.
        } finally {
            setSettingsHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!settingsHydrated) return;
        try {
            const { webSearch, webToolConfig, imageGen, danmakuEnabled, danmakuCount, debugDrawTags, tts, musicControl, engineeringTransition, curtainTransition, geminiNarrativeStyle, engineeringLoreRelationships, engineeringLoreExperiences, contextWindowTokens, storyTheme, imageSettings } = config;
            window.localStorage.setItem("shiorivia_local_preferences_v1", JSON.stringify({ webSearch, webToolConfig, imageGen, danmakuEnabled, danmakuCount, debugDrawTags, tts: false, musicControl, engineeringTransition, curtainTransition, geminiNarrativeStyle, engineeringLoreRelationships, engineeringLoreExperiences, contextWindowTokens, storyTheme, imageSettings, disabledProviders, apiProvider, providerCapabilities, providerModels, providerAliases }));
        } catch {
            // Local settings are best-effort; chat saves use their own storage.
        }
    }, [settingsHydrated, config.webSearch, config.webToolConfig, config.imageGen, config.danmakuEnabled, config.danmakuCount, config.debugDrawTags, config.tts, config.musicControl, config.terminalRequestLog, config.terminalLog, config.engineeringTransition, config.curtainTransition, config.geminiNarrativeStyle, config.engineeringLoreRelationships, config.engineeringLoreExperiences, config.contextWindowTokens, config.storyTheme, config.imageSettings, disabledProviders, apiProvider, providerCapabilities, providerModels, providerAliases]);

    const displayProviders = useMemo(() => allProviders.map(p => ({
        ...p, label: p.custom ? providerAliases[p.id] || p.label : p.label,
    })), [allProviders, providerAliases]);
    const visibleProviders = useMemo(() => getVisibleLocalProviders(displayProviders.filter(p => !p.custom || capabilityFor(p.id, providerCapabilities).llm), disabledProviders), [displayProviders, disabledProviders, providerCapabilities]);
    // The last selected provider is a preference, not a usable API connection.
    // A locked/empty BYOK vault must never appear as an active provider.
    const effectiveApiProvider = visibleProviders.some(p => p.id === apiProvider) ? apiProvider : "";
    useEffect(() => { setFalConfigured(Boolean(cloudCredentials.fal?.apiKey)); }, [cloudCredentials]);
    useEffect(() => {
        if (!settingsHydrated || visibleProviders.length === 0) return;
        if (!visibleProviders.some(p => p.id === apiProvider)) {
            const nextId = visibleProviders[0]?.id || '';
            if (nextId === apiProvider) return;
            setApiProvider(nextId);
            setConfig(prev => ({ ...prev, ...modelSelectionFor(providerModels, nextId) }));
        }
    }, [settingsHydrated, visibleProviders, apiProvider, providerModels]);
    const selectProvider = (id: string) => {
        if (!visibleProviders.some(p => p.id === id)) return;
        if (id === apiProvider) return;
        setApiProvider(id);
        setConfig(prev => ({ ...prev, ...modelSelectionFor(providerModels, id) }));
    };
    const selectCatalogModel = (id: string) => {
        setProviderModels(prev => selectProviderModel(prev, apiProvider, "catalog", id));
        setConfig(prev => ({ ...prev, selectedModel: id, customModelId: "" }));
    };
    const selectCustomModel = (id: string) => {
        setProviderModels(prev => selectProviderModel(prev, apiProvider, "custom", id));
        setConfig(prev => ({ ...prev, customModelId: id, selectedModel: "" }));
    };
    const toggleProviderDisabled = (id: string) => setDisabledProviders(prev =>
        prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );

    const toggleSetting = async (key: SettingKey) => {
        if (key === "musicControl" || key === "tts") return;
        if (key === "imageGen" && !config.imageGen) {
            if (!config.imageSettings.model.trim() || !allProviders.some(p =>
                p.id === config.imageSettings.provider && p.configured &&
                (p.id === "fal" || p.id === "google" || p.id === "openrouter" || (p.custom && capabilityFor(p.id, providerCapabilities).image)))) {
                ui.showToast(deepText(locale, "cloud.image.requiresModel"));
                return;
            }
        }
        if (!config[key] && key !== "webSearch" && key !== "imageGen") {
            try {
                const res = await fetch("/api/check_env");
                if (!res.ok) throw new Error("Environment check failed");
                const env = await res.json();
                const available: Record<SettingKey, boolean> = {
                    webSearch: true,
                    imageGen: config.imageSettings.provider === "comfyui" ? Boolean(env.hasComfy)
                        : config.imageSettings.provider === "fal" ? Boolean(env.hasFal)
                        : allProviders.some(p => p.id === config.imageSettings.provider && p.configured &&
                            (!p.custom || capabilityFor(p.id, providerCapabilities).image)),
                    tts: Boolean(env.hasTtsUrl),
                    musicControl: Boolean(env.hasMusic),
                };
                if (!available[key]) {
                    ui.showToast(deepText(locale, "app.providerMissing"));
                    return;
                }
            } catch {
                ui.showToast(deepText(locale, "app.providerValidationFailed"));
                return;
            }
        }
        setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const currentSession = cloud.sessions.find(s => s.id === currentSessionId);
    useEffect(() => {
        const tone: DialogTone = showCharta ? "charta" : currentSession?.memoryMode === "sliding" ? "story"
            : currentSession?.memoryMode === "chat" ? "umbra" : currentSession?.memoryMode === "novel" ? "tela"
            : currentSession?.memoryMode === "lime" ? "viae" : "officina";
        dialog.setTone(tone);
    }, [showCharta, currentSession?.memoryMode, dialog]);


    // Switching sessions must also restore the character on the Live2D stage.
    useEffect(() => {
        if (!currentSession) return;
        setActiveCharacterId(currentSession.memoryMode === "infinite" || currentSession.memoryMode === "chat"
            ? currentSession.characterId || "" : currentSession.characterId || "mutsu");
    }, [currentSession?.id, currentSession?.characterId, currentSession?.memoryMode]);
    const changeStoryRole = (role: "observer" | "participant") => {
        if (!currentSessionId || currentSession?.memoryMode !== "sliding") return;
        if (currentSession.messages.some(message => message.role === "user")) return;
        if (role === "participant" && !selfLibrary.activeSelf) { ui.showToast(deepText(locale, "app.storyNeedSelf")); return; }
        cloud.setSessions(prev => prev.map(s => s.id === currentSessionId ? {
            ...s, storyRole: role, storySelfId: role === "participant" ? selfLibrary.activeId : null,
             storyPovId: null, storyPovLocked: false, protagonist: undefined, charStatus: undefined, sceneCastIds: [],
            storySelfSnapshot: role === "participant" ? selfLibrary.activeSelf : null,
        } : s));
    };
    const changeStoryPov = (id: string) => {
        if (!currentSessionId || currentSession?.memoryMode !== "sliding" || currentSession.storyRole === "participant" || (currentSession.storyPovLocked && Boolean(currentSession.storyPovId))) return;
        if (!currentSession.messages.some(m => m.role === "assistant" && m.modelName !== "System" && !!String(m.content || "").trim())) return;
        if (id && (!(currentSession.sceneCastIds || []).includes(id) || !allChars.some(c => c.id === id))) return;
        cloud.setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, storyPovId: id || null, storyPovLocked: false, protagonist: undefined, charStatus: undefined } : s));
    };

    const engine = useChatEngine({
        currentSession, currentSessionId, setSessions: cloud.setSessions,
        activeCharacterId, voiceVariant,
        config: { ...config, terminalRequestLog: false, terminalLog: false },
        setTrackId: music.setTrackId,
        showToast: ui.showToast,
        setIsGlobalGenerating,
        manualOutfitId,
        apiProvider: effectiveApiProvider, cloudCredentials,
        customCharacters: charta.characters,
        storyWorlds: worldLibrary.worlds,
        customSelves: selfLibrary.selves,
        activeSelfId: selfLibrary.activeId,
    });

    const fileHandler = useFileHandler({
        setSessions: cloud.setSessions,
        setFolders: cloud.setFolders,
        setGlobalWorldInfo: cloud.setGlobalWorldInfo,
        setBgImage: cloud.setBgImage,
        setSelectedFile: engine.setSelectedFile,
        showToast: ui.showToast
    });

    useEffect(() => {
        if (settingsHydrated && cloud.initLoaded && cloud.sessions.length === 0 && !currentSessionId) {
            console.log("🌱 Creating Genesis Session...");
            const newId = Date.now().toString();
            const genesisSession: Session = {
                id: newId,
                title: defaultSessionTitle("infinite", locale),
                folderId: null,
                characterId: "",
                engineeringCharacterLocked: false,
                voiceVariant: "default",
                memoryMode: "infinite",
                messages: [{
                    role: "assistant",
                    content: officinaUnassignedWelcome(locale),
                    modelName: "System"
                }],
                updatedAt: Date.now()
            };
            cloud.setSessions([genesisSession]);
            setCurrentSessionId(newId);
            setActiveCharacterId("");
            if (config.engineeringTransition) ui.setEffect("math");
        }
        else if (cloud.sessions.length > 0 && (!currentSessionId || !cloud.sessions.find(s => s.id === currentSessionId))) {
            setCurrentSessionId(cloud.sessions[0].id);
            if (cloud.sessions[0].characterId) setActiveCharacterId(cloud.sessions[0].characterId);
        }
    }, [cloud.sessions, currentSessionId, cloud.initLoaded, settingsHydrated, config.engineeringTransition, locale]);

    const dynamicCharacter = useMemo(() => {
        const base = allChars.find(c => c.id === activeCharacterId) || CHAR_DATA[0];

        // Officina uses the selected character’s original identity, never a variant disguise.
        if (currentSession?.memoryMode === "infinite") return currentSession.characterId
            ? { ...base } : { ...base, id: "", name: "Officina", sub: "Character Engineer", avatar: "🛠️", hex: "#879baa" };
        if (currentSession?.memoryMode === "chat" && !currentSession.characterId)
            return { ...base, id: "", name: "Umbra", sub: "Character Chat", avatar: "🌿", hex: "#829e92" };
        let finalChar = { ...base };

        if (activeCharacterId === 'sakiko') {
            if (voiceVariant === 'black' || voiceVariant === 'oblivionis') {
                finalChar.name = "Oblivionis";
                finalChar.avatar = "🎭"; 
                finalChar.hex = "#483d8b"; 
            } else {
                finalChar.name = "丰川 祥子";
                finalChar.avatar = "🎹";
                finalChar.hex = "#7799CC"; 
            }
        }
        else if (activeCharacterId === 'mutsu') {
            if (voiceVariant === 'mortis') {
                finalChar.name = "Mortis";
                finalChar.avatar = "💀";
                finalChar.hex = "#2f4f4f"; 
            } else {
                finalChar.name = "若叶 睦";
                finalChar.avatar = "🥒";
                finalChar.hex = "#779977";
            }
        }
        else if (activeCharacterId === 'soyo') {
            if (voiceVariant === 'down') {
                finalChar.name = "长崎 素世 (Broken)";
                finalChar.avatar = "💔"; 
                finalChar.hex = "#5c5c5c"; 
            } else {
                finalChar.name = "长崎 素世";
                finalChar.avatar = "🥐";
                finalChar.hex = "#FFDD88";
            }
        }

        return finalChar;
    }, [activeCharacterId, voiceVariant, allChars, currentSession?.memoryMode]);

    const triggerCurtain = () => {
        if (!config.curtainTransition) return;
        setCurtainCycle(value => value + 1);
        ui.setEffect("curtain");
    };
    const triggerNovelScroll = () => {
        // The same optional transition setting controls both modes. Keep the
        // original curtain animation available for existing non-Tela effects.
        if (!config.curtainTransition) return;
        setCurtainCycle(value => value + 1);
        ui.setEffect("parchment");
    };

    const saveChatWorldline = (next: import("../lib/storyWorldline").StoryWorldline) => {
        if (currentSession?.memoryMode !== "chat") return;
        if (!canExtendWorldline(currentSession.storyWorldline, next)) {
            ui.showToast(deepText(locale, "app.worldlineLocked"));
            return;
        }
        cloud.setSessions(prev => prev.map(s => s.id === currentSessionId ? {
            ...s, storyWorldline: next,
            ...(s.characterId && !s.chatCharacterMemories && (s.stm || s.ltm) ? { chatCharacterMemories: { [s.characterId]: { stm: s.stm || "", ltm: s.ltm || "" } } } : {}),
            characterId: s.characterId && [...CHARACTERS, ...charta.characters].some(char =>
                char.id === s.characterId && storyCastAllowed(char, next)) ? s.characterId : "",
        } : s));
    };

    const createNewSession = (charId: string = activeCharacterId, targetMode?: 'sliding' | 'infinite' | 'novel' | 'chat' | 'lime') => {
        const newId = Date.now().toString();
        const currentMode = currentSession?.memoryMode || 'sliding';
        const nextMode = targetMode || currentMode;
        const sessionCharId = nextMode === "infinite" || nextMode === "chat" ? "" : charId;

        const charName = charta.characters.some(c => c.id === charId) ? nameForCharta(charta.characters.find(c => c.id === charId)!, locale) : characterDisplayName(charId, CHARACTERS.find(c => c.id === charId)?.name, locale);

        let initContent = "";
        if (nextMode === 'infinite') initContent = deepText(locale, "app.officinaWelcome");
        if (nextMode === 'chat') initContent = umbraUnassignedWelcome(locale);

        const initialMessages: any[] = [];
        if (initContent) {
            initialMessages.push({ 
                role: "assistant", 
                content: initContent, 
                modelName: "System" 
            });
        }

        const newSession: Session = {
            id: newId,
            title: nextMode === 'lime' ? "VIAE Workspace" : defaultSessionTitle(nextMode, locale),
            titleAutoManaged: nextMode === "sliding" || nextMode === "infinite" || nextMode === "chat" || nextMode === "novel",
            folderId: null,
            characterId: sessionCharId,
            ...(nextMode === "infinite" ? { engineeringCharacterLocked: false } : {}),
            voiceVariant: "default",
            messages: initialMessages,
            updatedAt: Date.now(),
            memoryMode: nextMode,
            ...(nextMode === 'lime' ? { limeGroups: [], limeGroupId: null } : {})
        };

        cloud.setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
        setActiveCharacterId(sessionCharId);

        if (targetMode) {
            if (targetMode === 'infinite' && config.engineeringTransition) ui.setEffect("math");
            // Novel entry is handled by enterMode so new/existing sessions share one transition.
        }
    };

    const enterMode = (mode: 'infinite' | 'sliding' | 'novel' | 'chat' | 'lime') => {
        const existing = cloud.sessions.find(session => session.memoryMode === mode);
        if (existing) {
            setCurrentSessionId(existing.id);
            setActiveCharacterId(mode === "infinite" || mode === "chat" ? existing.characterId || "" : existing.characterId || "mutsu");
        } else {
            createNewSession(activeCharacterId, mode);
        }
        setShowModeHub(false);
        if (mode === "novel") triggerNovelScroll();
    };

    const deleteSession = async (e: any, id: string) => {
        e.stopPropagation();
        if (!await dialog.confirm(deepText(locale, "app.deleteSessionAsk"), { destructive: true })) return;

        const remainingSessions = cloud.sessions.filter(s => s.id !== id);

        const sameModeSessions = remainingSessions.filter(s => s.memoryMode === currentSession?.memoryMode);
        const realitySessions = [
            ...sameModeSessions,
            ...remainingSessions.filter(s => s.memoryMode !== 'lime' && !sameModeSessions.includes(s))
        ];

        let finalSessions = remainingSessions;
        let nextSessionId = currentSessionId; 
        let nextCharId = activeCharacterId;   

        if (id === currentSessionId) {
            if (realitySessions.length > 0) {
                const next = realitySessions[0];
                nextSessionId = next.id;
                nextCharId = next.characterId;
            } else if (remainingSessions.length > 0) {
                const next = remainingSessions[0];
                nextSessionId = next.id;
                nextCharId = next.characterId;
            } else {
                nextSessionId = "GENESIS";
            }
        }

        if (nextSessionId === "GENESIS") {
            const genesisId = Date.now().toString();
            const genesisSession: Session = {
                id: genesisId,
                title: defaultSessionTitle("infinite", locale),
                folderId: null,
                characterId: "",
                engineeringCharacterLocked: false,
                voiceVariant: "default",
                memoryMode: "infinite",
                messages: [{
                    role: "assistant",
                    content: officinaUnassignedWelcome(locale),
                    modelName: "System"
                }],
                updatedAt: Date.now()
            };

            finalSessions = [genesisSession];
            nextSessionId = genesisId;
            nextCharId = "";

            if (config.engineeringTransition) ui.setEffect("math");
            ui.showToast(deepText(locale, "app.engineeringCreated"));
        } else {
            ui.showToast(deepText(locale, "app.sessionDeleted"));
        }

        if (nextSessionId !== currentSessionId) {
            setCurrentSessionId(nextSessionId);
            setActiveCharacterId(nextCharId || "");
        }

        cloud.setSessions(finalSessions);
    };

    const stageCharId = currentSession?.memoryMode === 'infinite' || currentSession?.memoryMode === 'chat'
        ? activeCharacterId
        : (currentSession?.live2dCharId || activeCharacterId); 

    const effectiveConfig = useMemo(() => {
        // Live2D is on hold; an empty config is expected, not a missing asset error.
        if (process.env.NEXT_PUBLIC_ENABLE_LOCAL_LIVE2D !== "true" || !stageCharId) return null;
        const rawConfig = LOCAL_LIVE2D_CONFIG as Record<string, any>;
        
        if (rawConfig[stageCharId]) {
            console.log(`🎯 [Smart Match] Exact: ${stageCharId}`);
            return rawConfig[stageCharId];
        }

        const fuzzyKey = Object.keys(rawConfig).find(key => 
            key.toLowerCase().includes(stageCharId.toLowerCase()) || 
            stageCharId.toLowerCase().includes(key.toLowerCase())
        );

        if (fuzzyKey) {
            console.log(`🎯 [Smart Match] Fuzzy: ${stageCharId} -> ${fuzzyKey}`);
            return rawConfig[fuzzyKey];
        }

        console.warn(`⚠️ [Smart Match] Failed to find config for: ${stageCharId}`);
        return null;
    }, [stageCharId]);

    const stageMotion = currentSession?.memoryMode === 'chat' ? "idle" : (currentSession?.currentEmotion || "idle");
    const stageOutfit = currentSession?.memoryMode === 'chat'
        ? (manualOutfitId || "default")
        : (currentSession?.currentOutfitId || manualOutfitId || "default");
    const customStage = charta.characters.find(c => c.id === stageCharId);
    const stageDbChar = useMemo(() =>
        allChars.find(c => c.id === stageCharId),
        [stageCharId, allChars]);

    // Live2D is opt-in until the Cubism Core redistribution/licensing review is complete.
    const showLive2D = process.env.NEXT_PUBLIC_ENABLE_LOCAL_LIVE2D === "true" && effectiveConfig && (
        effectiveConfig.modelUrl ||
        (effectiveConfig.outfits && Object.keys(effectiveConfig.outfits).length > 0)
    );

    // Keep the same transition host mounted while the hub, Tela and other
    // modes swap screens. Otherwise enter/exit unmounts and restarts the scroll.
    const renderWithTransition = (screen: ReactNode) => (
        <>
            {screen}
            <TransitionEffects key={curtainCycle} effect={ui.effect} onComplete={handleEffectComplete} />
        </>
    );

    if (showCharta && cloud.initLoaded) {
        return renderWithTransition(<ChartaInterface characters={charta.characters} save={charta.save} remove={charta.remove} selfLibrary={selfLibrary} worldLibrary={worldLibrary} initialSection={chartaInitialSection}
            loaded={charta.loaded} storageError={charta.error}
            usedIds={cloud.sessions.flatMap(s => [s.characterId, ...((s.limeGroups || []).flatMap(g => g.members))])}
            onExit={() => { setShowCharta(false); setShowModeHub(true); }} />);
    }
    if (!cloud.initLoaded || showModeHub) {
        return renderWithTransition(
            <>
                <ModeHub
                    onEnter={enterMode}
                    onOpenCharta={() => { setChartaInitialSection("characters"); setShowCharta(true); }}
                    onResume={() => { if (cloud.initLoaded) { setShowModeHub(false); if (currentSession?.memoryMode === "novel") triggerNovelScroll(); } }}
                    onOpenSettings={() => setShowSettingsCenter(true)}
                    hasSession={Boolean(currentSession)}
                    loading={!cloud.initLoaded}
                    syncStatus={cloud.status}
                />
                <SettingsCenter
                    open={showSettingsCenter}
                    onClose={() => setShowSettingsCenter(false)}
                    values={config}
                    onToggle={toggleSetting}
                    debugMode={ui.debugMode}
                danmakuEnabled={config.danmakuEnabled}
                onToggleDanmaku={() => setConfig(prev => ({ ...prev, danmakuEnabled: !prev.danmakuEnabled }))}
                danmakuCount={config.danmakuCount}
                onDanmakuCountChange={(count: number) => setConfig(prev => ({ ...prev, danmakuCount: count }))}
                debugDrawTagsEnabled={config.debugDrawTags}
                onToggleDebugDrawTags={() => setConfig(prev => ({ ...prev, debugDrawTags: !prev.debugDrawTags }))}
                    onToggleDebug={() => ui.setDebugMode(prev => !prev)}
                    terminalRequestLogEnabled={config.terminalRequestLog}
                    onToggleTerminalRequestLog={() => setConfig(prev => ({ ...prev, terminalRequestLog: !prev.terminalRequestLog }))}
                    terminalLogEnabled={config.terminalLog}
                    onToggleTerminalLog={() => setConfig(prev => ({ ...prev, terminalLog: !prev.terminalLog }))}
                    engineeringTransitionEnabled={config.engineeringTransition}
                    curtainTransitionEnabled={config.curtainTransition}
                    onToggleCurtainTransition={() => setConfig(prev => ({ ...prev, curtainTransition: !prev.curtainTransition }))}
                    geminiNarrativeStyleEnabled={config.geminiNarrativeStyle}
                    engineeringLoreRelationshipsEnabled={config.engineeringLoreRelationships}
                    engineeringLoreExperiencesEnabled={config.engineeringLoreExperiences}
                    onToggleEngineeringLoreRelationships={() => setConfig(prev => ({ ...prev, engineeringLoreRelationships: !prev.engineeringLoreRelationships }))}
                    onToggleEngineeringLoreExperiences={() => setConfig(prev => ({ ...prev, engineeringLoreExperiences: !prev.engineeringLoreExperiences }))}
                    onToggleGeminiNarrativeStyle={() => setConfig(prev => ({ ...prev, geminiNarrativeStyle: !prev.geminiNarrativeStyle }))}
                    onToggleEngineeringTransition={() => setConfig(prev => ({ ...prev, engineeringTransition: !prev.engineeringTransition }))}
                    onTestEffect={ui.setEffect}
                    isStory={false}
                activeMode="hub"
                contextWindowTokens={config.contextWindowTokens}
                onContextWindowChange={(value) => setConfig(prev => ({ ...prev, contextWindowTokens: value }))}
                    storyTheme={config.storyTheme}
                    onStoryThemeChange={(value) => setConfig(prev => ({ ...prev, storyTheme: value }))}
                    activeProvider={effectiveApiProvider}
                    providers={displayProviders}
                    disabledProviders={disabledProviders}
                    onToggleProvider={toggleProviderDisabled}
                    autoSync={syncPreferences.autoSync}
                    autoSyncInterval={syncPreferences.autoSyncInterval}
                    onAutoSyncChange={(autoSync) => updateSyncPreferences({ ...syncPreferences, autoSync })}
                    onAutoSyncIntervalChange={(autoSyncInterval) => updateSyncPreferences({ ...syncPreferences, autoSyncInterval })}
                        webToolConfig={config.webToolConfig}
                onWebToolConfigChange={(patch: Partial<WebToolConfig>) => setConfig(prev => ({ ...prev, webToolConfig: { ...prev.webToolConfig, ...patch } }))}
                providerAliases={providerAliases}
                onProviderAliasChange={(id: string, label: string) => setProviderAliases(prev => ({ ...prev, [id]: label.slice(0, 40) }))}
                imageSettings={config.imageSettings}
                        onImageSettingsChange={(patch) => setConfig(prev => ({...prev, imageSettings: {...prev.imageSettings, ...patch}}))}
                        providerCapabilities={providerCapabilities}
                        onProviderCapabilitiesChange={(id, capability) => setProviderCapabilities(prev => ({ ...prev, [id]: { ...capabilityFor(id, prev), ...capability } }))}
                        falConfigured={falConfigured}
                cloudCredentials={cloudCredentials}
                onCloudCredentialChange={updateCloudCredential}
                credentialVaultStatus={vaultStatus}
                credentialVaultBusy={vaultBusy}
                credentialVaultError={vaultError}
                credentialVaultDraft={vaultDraft}
                credentialVaultHasSaved={vaultHasSaved}
                credentialRuntimeUnlocked={runtimeUnlocked}
                onCredentialVaultSubmit={submitCloudVault}
                onCredentialVaultEdit={startVaultEditor}
                onCredentialVaultCancelEdit={cancelVaultEditor}
                onCredentialVaultDecrypt={decryptVaultForUse}
                onCredentialVaultClearMemory={clearRuntimeCredentials}
                onCredentialVaultReset={resetCloudVault}
                />
            </>
        );
    }

    // Legacy persisted ID "lime" remains the VIAE workspace discriminator.
    if (currentSession?.memoryMode === 'lime') {
        return renderWithTransition(
            <>
                <ViaeInterface
                    session={currentSession}
                    updateSession={(updater) => cloud.setSessions(prev => prev.map(s => s.id === currentSession.id ? updater(s) : s))}
                    characters={allChars}
                    customCharacters={charta.characters}
                    worlds={worldLibrary.worlds}
                    activeSelf={selfLibrary.activeSelf}
                    terminalRequestLogEnabled={ui.debugMode && config.terminalRequestLog}
                    terminalLogEnabled={ui.debugMode && config.terminalLog}
                    contextWindowTokens={config.contextWindowTokens}
                    onExit={() => setShowModeHub(true)}
                    onSettings={() => setShowSettingsCenter(true)}
                    onManualSync={() => cloud.triggerSync("manual")}
                    syncStatus={cloud.status}
                    providers={visibleProviders}
                    provider={effectiveApiProvider}
                    onProviderChange={selectProvider}
                    model={config.selectedModel}
                    customModel={config.customModelId}
                    onModelChange={selectCatalogModel}
                    onCustomModelChange={selectCustomModel}
                    notify={ui.showToast}
                />
                <SettingsCenter
                    open={showSettingsCenter}
                    onClose={() => setShowSettingsCenter(false)}
                    values={config}
                    onToggle={toggleSetting}
                    debugMode={ui.debugMode}
                danmakuEnabled={config.danmakuEnabled}
                onToggleDanmaku={() => setConfig(prev => ({ ...prev, danmakuEnabled: !prev.danmakuEnabled }))}
                danmakuCount={config.danmakuCount}
                onDanmakuCountChange={(count: number) => setConfig(prev => ({ ...prev, danmakuCount: count }))}
                debugDrawTagsEnabled={config.debugDrawTags}
                onToggleDebugDrawTags={() => setConfig(prev => ({ ...prev, debugDrawTags: !prev.debugDrawTags }))}
                    onToggleDebug={() => ui.setDebugMode(prev => !prev)}
                    terminalRequestLogEnabled={config.terminalRequestLog}
                    onToggleTerminalRequestLog={() => setConfig(prev => ({ ...prev, terminalRequestLog: !prev.terminalRequestLog }))}
                    terminalLogEnabled={config.terminalLog}
                    onToggleTerminalLog={() => setConfig(prev => ({ ...prev, terminalLog: !prev.terminalLog }))}
                    engineeringTransitionEnabled={config.engineeringTransition}
                    curtainTransitionEnabled={config.curtainTransition}
                    onToggleCurtainTransition={() => setConfig(prev => ({ ...prev, curtainTransition: !prev.curtainTransition }))}
                    geminiNarrativeStyleEnabled={config.geminiNarrativeStyle}
                    engineeringLoreRelationshipsEnabled={config.engineeringLoreRelationships}
                    engineeringLoreExperiencesEnabled={config.engineeringLoreExperiences}
                    onToggleEngineeringLoreRelationships={() => setConfig(prev => ({ ...prev, engineeringLoreRelationships: !prev.engineeringLoreRelationships }))}
                    onToggleEngineeringLoreExperiences={() => setConfig(prev => ({ ...prev, engineeringLoreExperiences: !prev.engineeringLoreExperiences }))}
                    onToggleGeminiNarrativeStyle={() => setConfig(prev => ({ ...prev, geminiNarrativeStyle: !prev.geminiNarrativeStyle }))}
                    onToggleEngineeringTransition={() => setConfig(prev => ({ ...prev, engineeringTransition: !prev.engineeringTransition }))}
                    onTestEffect={ui.setEffect}
                    isStory={false}
                activeMode="lime"
                contextWindowTokens={config.contextWindowTokens}
                onContextWindowChange={(value) => setConfig(prev => ({ ...prev, contextWindowTokens: value }))}
                    storyTheme={config.storyTheme}
                    onStoryThemeChange={value => setConfig(prev => ({ ...prev, storyTheme: value }))}
                    activeProvider={effectiveApiProvider}
                    providers={displayProviders}
                    disabledProviders={disabledProviders}
                    onToggleProvider={toggleProviderDisabled}
                    autoSync={syncPreferences.autoSync}
                    autoSyncInterval={syncPreferences.autoSyncInterval}
                    onAutoSyncChange={(autoSync) => updateSyncPreferences({ ...syncPreferences, autoSync })}
                    onAutoSyncIntervalChange={(autoSyncInterval) => updateSyncPreferences({ ...syncPreferences, autoSyncInterval })}
                    webToolConfig={config.webToolConfig}
                onWebToolConfigChange={(patch: Partial<WebToolConfig>) => setConfig(prev => ({ ...prev, webToolConfig: { ...prev.webToolConfig, ...patch } }))}
                providerAliases={providerAliases}
                onProviderAliasChange={(id: string, label: string) => setProviderAliases(prev => ({ ...prev, [id]: label.slice(0, 40) }))}
                imageSettings={config.imageSettings}
                    onImageSettingsChange={(patch) => setConfig(prev => ({...prev, imageSettings: {...prev.imageSettings, ...patch}}))}
                    providerCapabilities={providerCapabilities}
                    onProviderCapabilitiesChange={(id, capability) => setProviderCapabilities(prev => ({ ...prev, [id]: { ...capabilityFor(id, prev), ...capability } }))}
                    falConfigured={falConfigured}
                cloudCredentials={cloudCredentials}
                onCloudCredentialChange={updateCloudCredential}
                credentialVaultStatus={vaultStatus}
                credentialVaultBusy={vaultBusy}
                credentialVaultError={vaultError}
                credentialVaultDraft={vaultDraft}
                credentialVaultHasSaved={vaultHasSaved}
                credentialRuntimeUnlocked={runtimeUnlocked}
                onCredentialVaultSubmit={submitCloudVault}
                onCredentialVaultEdit={startVaultEditor}
                onCredentialVaultCancelEdit={cancelVaultEditor}
                onCredentialVaultDecrypt={decryptVaultForUse}
                onCredentialVaultClearMemory={clearRuntimeCredentials}
                onCredentialVaultReset={resetCloudVault}
                />

            </>
        );
    }

    if (currentSession?.memoryMode === 'novel') {
        return renderWithTransition(
            <>
            <NovelInterface
                currentSession={currentSession}
                initialSelectedModel={config.customModelId || config.selectedModel}
                provider={effectiveApiProvider}
                providers={visibleProviders}
                onProviderChange={selectProvider}
                selectedModel={config.selectedModel}
                customModelId={config.customModelId}
                onModelChange={selectCatalogModel}
                onCustomModelChange={selectCustomModel}
                onImportNovelSession={(source: Session, draft?: NovelDraft) => {
                    // Always create a distinct session; imported JSON must not overwrite existing saves.
                    const importedId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-novel`;
                    const imported: Session = {
                        ...source, id: importedId, folderId: null,
                        title: source.title || "Imported Novel", memoryMode: "novel",
                        updatedAt: Date.now(), ...(draft ? { novelDraft: draft } : {}),
                    };
                    cloud.setSessions(prev => [imported, ...prev]);
                    setCurrentSessionId(importedId);
                    setActiveCharacterId(imported.characterId || "mutsu");
                    ui.showToast(deepText(locale, "app.novelImported"));
                }}
                handleSend={engine.handleSend}
                isLoading={engine.isLoading}
                onCompleteMissingMetadata={engine.completeMissingMetadata}
                metadataRepairing={engine.storyStateRepairing}
                createNewSession={createNewSession}
                dbChars={allChars}
                storyWorlds={worldLibrary.worlds}
                customCharacters={charta.characters}
                customSelves={selfLibrary.selves}
                activeNovelSelf={selfLibrary.activeSelf}
                onOpenCharta={() => { setChartaInitialSection("worlds"); setShowCharta(true); }}
                stopGeneration={engine.stopGeneration}
                handleRegenerate={engine.handleRegenerate}
                onGenerateDraw={engine.generateDraw} imageSettings={config.imageSettings} debugMode={ui.debugMode && config.debugDrawTags} useImageGen={config.imageGen} showToast={ui.showToast}
                danmakuEnabled={config.danmakuEnabled} danmakuCount={config.danmakuCount}
                setIsGlobalGenerating={setIsGlobalGenerating}
                onImageGenerated={async () => {
                    ui.showToast(deepText(locale, "cloud.image.noGallery"));
                    return "";
                }}
                onManualSync={() => cloud.triggerSync('manual')}
                syncStatus={cloud.status}

                setSessions={cloud.setSessions}
                onExit={() => { setShowModeHub(true); triggerNovelScroll(); }}
                onOpenSettings={() => setShowSettingsCenter(true)}
                updateSessionTitle={(id: string, t: string) => cloud.setSessions(p => p.map(s => s.id === id ? { ...s, title: t, titleAutoManaged: false, updatedAt: Date.now() } : s))}
                deleteMessage={engine.handleDeleteMessage}
                updateSessionInfo={(id: string, up: any) => cloud.setSessions(p => p.map(s => s.id === id ? { ...s, ...up } : s))}
            />
            <SettingsCenter
                open={showSettingsCenter}
                onClose={() => setShowSettingsCenter(false)}
                values={config}
                onToggle={toggleSetting}
                debugMode={ui.debugMode}
                danmakuEnabled={config.danmakuEnabled}
                onToggleDanmaku={() => setConfig(prev => ({ ...prev, danmakuEnabled: !prev.danmakuEnabled }))}
                danmakuCount={config.danmakuCount}
                onDanmakuCountChange={(count: number) => setConfig(prev => ({ ...prev, danmakuCount: count }))}
                debugDrawTagsEnabled={config.debugDrawTags}
                onToggleDebugDrawTags={() => setConfig(prev => ({ ...prev, debugDrawTags: !prev.debugDrawTags }))}
                onToggleDebug={() => ui.setDebugMode(prev => !prev)}
                terminalRequestLogEnabled={config.terminalRequestLog}
                onToggleTerminalRequestLog={() => setConfig(prev => ({ ...prev, terminalRequestLog: !prev.terminalRequestLog }))}
                terminalLogEnabled={config.terminalLog}
                onToggleTerminalLog={() => setConfig(prev => ({ ...prev, terminalLog: !prev.terminalLog }))}
                engineeringTransitionEnabled={config.engineeringTransition}
                curtainTransitionEnabled={config.curtainTransition}
                onToggleCurtainTransition={() => setConfig(prev => ({ ...prev, curtainTransition: !prev.curtainTransition }))}
                    geminiNarrativeStyleEnabled={config.geminiNarrativeStyle}
                    engineeringLoreRelationshipsEnabled={config.engineeringLoreRelationships}
                    engineeringLoreExperiencesEnabled={config.engineeringLoreExperiences}
                    onToggleEngineeringLoreRelationships={() => setConfig(prev => ({ ...prev, engineeringLoreRelationships: !prev.engineeringLoreRelationships }))}
                    onToggleEngineeringLoreExperiences={() => setConfig(prev => ({ ...prev, engineeringLoreExperiences: !prev.engineeringLoreExperiences }))}
                    onToggleGeminiNarrativeStyle={() => setConfig(prev => ({ ...prev, geminiNarrativeStyle: !prev.geminiNarrativeStyle }))}
                onToggleEngineeringTransition={() => setConfig(prev => ({ ...prev, engineeringTransition: !prev.engineeringTransition }))}
                onTestEffect={ui.setEffect}
                isStory={false}
                activeMode="novel"
                contextWindowTokens={config.contextWindowTokens}
                onContextWindowChange={(value) => setConfig(prev => ({ ...prev, contextWindowTokens: value }))}
                storyTheme={config.storyTheme}
                onStoryThemeChange={value => setConfig(prev => ({ ...prev, storyTheme: value }))}
                activeProvider={effectiveApiProvider}
                providers={displayProviders}
                disabledProviders={disabledProviders}
                onToggleProvider={toggleProviderDisabled}
                autoSync={syncPreferences.autoSync}
                autoSyncInterval={syncPreferences.autoSyncInterval}
                onAutoSyncChange={(autoSync) => updateSyncPreferences({ ...syncPreferences, autoSync })}
                onAutoSyncIntervalChange={(autoSyncInterval) => updateSyncPreferences({ ...syncPreferences, autoSyncInterval })}
                webToolConfig={config.webToolConfig}
                onWebToolConfigChange={(patch: Partial<WebToolConfig>) => setConfig(prev => ({ ...prev, webToolConfig: { ...prev.webToolConfig, ...patch } }))}
                providerAliases={providerAliases}
                onProviderAliasChange={(id: string, label: string) => setProviderAliases(prev => ({ ...prev, [id]: label.slice(0, 40) }))}
                imageSettings={config.imageSettings}
                onImageSettingsChange={(patch) => setConfig(prev => ({...prev, imageSettings: {...prev.imageSettings, ...patch}}))}
                providerCapabilities={providerCapabilities}
                onProviderCapabilitiesChange={(id, capability) => setProviderCapabilities(prev => ({ ...prev, [id]: { ...capabilityFor(id, prev), ...capability } }))}
                falConfigured={falConfigured}
                cloudCredentials={cloudCredentials}
                onCloudCredentialChange={updateCloudCredential}
                credentialVaultStatus={vaultStatus}
                credentialVaultBusy={vaultBusy}
                credentialVaultError={vaultError}
                credentialVaultDraft={vaultDraft}
                credentialVaultHasSaved={vaultHasSaved}
                credentialRuntimeUnlocked={runtimeUnlocked}
                onCredentialVaultSubmit={submitCloudVault}
                onCredentialVaultEdit={startVaultEditor}
                onCredentialVaultCancelEdit={cancelVaultEditor}
                onCredentialVaultDecrypt={decryptVaultForUse}
                onCredentialVaultClearMemory={clearRuntimeCredentials}
                onCredentialVaultReset={resetCloudVault}
            />
            </>
        );
    }


    return renderWithTransition(
        <div
            className="flex h-screen text-slate-800 font-sans overflow-hidden relative"
            onDrop={fileHandler.handleBgDrop}
            onDragOver={(e) => e.preventDefault()}
        >
            <Background hex={(currentSession?.memoryMode === 'infinite' || currentSession?.memoryMode === 'chat') && !currentSession.characterId
                ? "#dce4e9" : currentSession?.memoryMode === 'sliding'
                ? ({ sky: "#e0f2fe", sage: "#b7d3b0", rose: "#f4c6d2" }[config.storyTheme])
                : dynamicCharacter.hex} bgImage={(currentSession?.memoryMode === 'infinite' || currentSession?.memoryMode === 'chat') && !currentSession.characterId ? undefined : cloud.bgImage} />

            {stageDbChar && (
                customStage ? (
                    customStage.portrait ? <StaticPortraitStage
                        src={customStage.portrait}
                        leftSidebarOpen={ui.leftSidebarOpen}
                        rightSidebarOpen={ui.rightSidebarOpen}
                    /> : null
                ) : showLive2D ? (
                    <Live2DStage
                        key={stageCharId}
                        characterId={stageCharId}
                        config={effectiveConfig}
                        emotion={stageMotion}
                        outfitId={stageOutfit}
                        rightSidebarOpen={ui.rightSidebarOpen}
                        leftSidebarOpen={ui.leftSidebarOpen}
                    />
                ) : (
                    <TachieStage
                        characters={[{
                            name: stageDbChar.name, 
                            id: stageDbChar.id,     
                            current_sprite: stageMotion
                        }]}
                        dbChars={allChars}
                    />
                )
            )}

            <div className="relative z-10 flex w-full h-full">

                <SidebarLeft
                    isOpen={ui.leftSidebarOpen} onClose={() => ui.setLeftSidebarOpen(false)}
                    currentMode={currentSession?.memoryMode}
                    chatWorldline={currentSession?.memoryMode === "chat" ? currentSession.storyWorldline : undefined}
                    onSaveChatWorldline={saveChatWorldline}
                    chatWorldlineOpenSignal={chatWorldlineOpenSignal}
                    storyWorlds={worldLibrary.worlds}

                    expandedGroups={Array.isArray(config.expandedGroups) ? config.expandedGroups : []}
                    setExpandedGroups={(action: any) => {
                        setConfig(prev => {
                            const currentList = Array.isArray(prev.expandedGroups) ? prev.expandedGroups : [];
                            const nextList = typeof action === 'function' ? action(currentList) : action;
                            return { ...prev, expandedGroups: nextList };
                        });
                    }}
                    selectedModel={config.selectedModel}
                    setSelectedModel={selectCatalogModel}
                    customModelId={config.customModelId}
                    setCustomModelId={selectCustomModel}

                    folders={cloud.folders} setFolders={cloud.setFolders}
                    sessions={cloud.sessions} currentSessionId={currentSessionId} setCurrentSessionId={setCurrentSessionId}
                    createFolder={() => cloud.setFolders(prev => [...prev, { id: Date.now().toString(), name: "New Folder", isExpanded: true }])}
                    toggleFolder={(id: string) => cloud.setFolders(prev => prev.map(f => f.id === id ? { ...f, isExpanded: !f.isExpanded } : f))}
                    deleteFolder={async (e: any, id: string) => { e.stopPropagation(); if (await dialog.confirm(deepText(locale, "app.deleteFolderAsk"), { destructive: true })) cloud.setFolders(prev => prev.filter(f => f.id !== id)) }}
                    createNewSession={createNewSession}
                    deleteSession={deleteSession}

                    searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                    editingSessionId={editingSessionId} setEditingSessionId={setEditingSessionId}
                    tempTitle={tempTitle} setTempTitle={setTempTitle}
                    activeMenuSessionId={activeMenuSessionId} setActiveMenuSessionId={setActiveMenuSessionId}
                    updateSessionTitle={(id: string, t: string) => { cloud.setSessions(prev => prev.map(s => s.id === id ? { ...s, title: t, titleAutoManaged: false, updatedAt: Date.now() } : s)); setEditingSessionId(null); ui.showToast(deepText(locale, "app.sessionRenamed")); }}
                    moveSessionToFolder={(sid: string, fid: string | null) => { cloud.setSessions(prev => prev.map(s => s.id === sid ? { ...s, folderId: fid, updatedAt: Date.now() } : s)); setActiveMenuSessionId(null); ui.showToast(deepText(locale, "app.sessionMoved")); }}
                    onBindEngineeringProject={(sid: string, project: string) => cloud.setSessions(prev => prev.map(s => s.id === sid && s.memoryMode === "infinite" ? { ...s, engineeringProjectRoot: project, updatedAt: Date.now() } : s))}

                    handleExportData={() => { const d = { sessions: cloud.sessions, folders: cloud.folders, globalWorldInfo: cloud.globalWorldInfo, bgImage: cloud.bgImage }; const b = new Blob([JSON.stringify(d)], { type: "application/json" }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = "backup.json"; a.click(); }}
                    handleImportData={fileHandler.handleImportData}
                    importInputRef={fileHandler.importInputRef}

                    apiProvider={effectiveApiProvider}
                    setApiProvider={selectProvider}
                    providers={visibleProviders}
                    isMobile={false} 

                    useImageGen={config.imageGen}
                    toggleImageGen={() => void toggleSetting("imageGen")}

                    useTTS={config.tts}
                    toggleTTS={() => void toggleSetting("tts")}

                    onManualSync={() => cloud.triggerSync('manual')}
                    syncStatus={cloud.status}

                    useMusicControl={config.musicControl}
                    toggleMusicControl={() => ui.showToast(deepText(locale,"cloud.music.unavailable"))}

                    triggerEffect={ui.setEffect}
                    batchDelete={(ids: string[]) => cloud.setSessions(prev => prev.filter(s => !ids.includes(s.id)))}
                />

                <ChatInterface
                    onOpenHub={() => setShowModeHub(true)}
                    onOpenSettings={() => setShowSettingsCenter(true)}
                    onOpenMemory={() => currentSession?.memoryMode === "infinite"
                        ? undefined : currentSession?.memoryMode === "chat" && !currentSession.characterId
                        ? ui.showToast(deepText(locale, "app.umbraNeedCharacter")) : setShowMemoryVault(true)}
                    leftSidebarOpen={ui.leftSidebarOpen} setLeftSidebarOpen={ui.setLeftSidebarOpen}
                    rightSidebarOpen={ui.rightSidebarOpen} setRightSidebarOpen={ui.setRightSidebarOpen}
                    setShowLocalWorld={ui.setShowLocalWorld}
                    onOpenStoryWorldline={() => { ui.setRightSidebarOpen(true); setWorldlineOpenSignal(value => value + 1); }}
                    onOpenChatWorldline={() => { ui.setLeftSidebarOpen(true); setChatWorldlineOpenSignal(value => value + 1); }}
                    debugMode={ui.debugMode} setDebugMode={ui.setDebugMode}
                    showDrawDebugTags={ui.debugMode && config.debugDrawTags}

                    currentCharacter={dynamicCharacter} currentSession={currentSession}
                    input={engine.input} setInput={engine.setInput}
                    isLoading={engine.isLoading}
                    showToast={ui.showToast} outfits={effectiveConfig?.outfits || {}}

                    selectedModel={config.selectedModel} customModelId={config.customModelId} isMultimodal={true}
                    useTTS={config.tts} 

                    selectedFile={engine.selectedFile} setSelectedFile={engine.setSelectedFile}
                    fileInputRef={fileHandler.fileInputRef} handleFileSelect={fileHandler.handleFileSelect}

                    dbChars={allChars} currentOutfitId={manualOutfitId} setManualOutfitId={setManualOutfitId}
                    isGlobalGenerating={isGlobalGenerating}

                    apiProvider={effectiveApiProvider}
                    setApiProvider={selectProvider}

                    handleSend={engine.handleSend} stopGeneration={engine.stopGeneration}
                    handleRegenerate={engine.handleRegenerate} handleDeleteMessage={engine.handleDeleteMessage}
                    onCompleteEngineeringOutput={engine.completeEngineeringOutput}
                    onCompleteStoryState={engine.completeStoryState}
                    onCompleteMissingMetadata={engine.completeMissingMetadata}
                    storyStateRepairing={engine.storyStateRepairing}
                    onGenerateDraw={engine.generateDraw} imageSettings={config.imageSettings} useImageGen={config.imageGen}
                    handleCopy={(t: string, i: number) => {
                        navigator.clipboard.writeText(t);
                        setCopiedIndex(i); 
                        setTimeout(() => setCopiedIndex(null), 2000);
                    }}
                    copiedIndex={copiedIndex}
                    triggerEffect={ui.setEffect}

                    openEditModal={(i: number, c: any) => {
                        ui.setEditModal({ isOpen: true, text: typeof c === 'string' ? c : c[0].text, index: i });
                    }}
                    toggleSaveModal={() => ui.setShowSaveModal(true)}
                    toggleCodeRepo={() => ui.setShowCodeRepo(true)}

                    playingIndex={playingIndex}
                    handlePlayAudio={async (text: string, index: number, charId?: string) => {
                        setPlayingIndex(index); 
                        try {
                            const res = await fetch("/api/tts", {
                                method: "POST",
                                body: JSON.stringify({ text, characterId: charId || activeCharacterId, variant: voiceVariant })
                            });
                            if (!res.ok) throw new Error();
                            const url = URL.createObjectURL(await res.blob());
                            const audio = new Audio(url);
                            audioRef.current = audio; 
                            audio.play();

                            audio.onended = () => setPlayingIndex(null);
                            audio.onerror = () => setPlayingIndex(null);
                        } catch {
                            setPlayingIndex(null);
                        }
                    }}
                    createNewSession={createNewSession}
                />

                <DanmakuOverlay danmakuList={config.danmakuEnabled && currentSession?.memoryMode === "sliding" ? currentSession?.lastDanmaku : []} />
                <AnimatePresence>{(ui.leftSidebarOpen || ui.rightSidebarOpen) && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { ui.setLeftSidebarOpen(false); ui.setRightSidebarOpen(false) }} className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" />}</AnimatePresence>

                <SidebarRight
                    isOpen={ui.rightSidebarOpen} onClose={() => ui.setRightSidebarOpen(false)}
                    activeStorySelf={selfLibrary.activeSelf}
                    worlds={worldLibrary.worlds} customCharacters={charta.characters} isGenerating={engine.isLoading}
                    setInput={engine.setInput} worldlineOpenSignal={worldlineOpenSignal}
                    onOpenChartaWorld={() => { setChartaInitialSection("worlds"); setShowCharta(true); }}
                    storySelf={currentSession?.storySelfSnapshot || selfLibrary.selves.find(self => self.id === currentSession?.storySelfId) || null}
                    onStoryRoleChange={changeStoryRole} onStoryPovChange={changeStoryPov}
                    currentCharacter={dynamicCharacter} currentSession={currentSession}
                    onOpenMemory={() => currentSession?.memoryMode === "infinite"
                        ? undefined : currentSession?.memoryMode === "chat" && !currentSession.characterId
                        ? ui.showToast(deepText(locale, "app.umbraNeedCharacter")) : setShowMemoryVault(true)}
                    activeCharacterId={activeCharacterId} setActiveCharacterId={setActiveCharacterId}
                    createNewSession={createNewSession} handleSend={engine.handleSend} setSessions={cloud.setSessions} currentSessionId={currentSessionId}
                    voiceVariant={voiceVariant} onRepoUpdate={engine.handleRepoUpdate}
                    onCharSwitch={(id: string) => {
                        if (engine.isLoading) return;
                        if (currentSession?.memoryMode === "infinite" && isEngineeringCharacterLocked(currentSession)) {
                            ui.showToast(deepText(locale, "app.engineerLocked"));
                            return;
                        }
                        setActiveCharacterId(id);
                        setVoiceVariant("default");
                        cloud.setSessions(prev => prev.map(s => s.id === currentSessionId
                            ? { ...s, characterId: id,
                                ...(s.memoryMode === "chat" && s.characterId && !s.chatCharacterMemories && (s.stm || s.ltm)
                                    ? { chatCharacterMemories: { [s.characterId]: { stm: s.stm || "", ltm: s.ltm || "" } } } : {}) } : s));
                    }}
                    dbChars={allChars}
                />
            </div>


            <CodeRepositoryModal isOpen={ui.showCodeRepo} onClose={() => ui.setShowCodeRepo(false)}
                repository={currentSession?.codeRepository || {}} onUpdate={engine.handleRepoUpdate}
                projectRoot={currentSession?.memoryMode === "infinite" ? currentSession.engineeringProjectRoot || "" : ""}
                onBindProject={(project: string) => cloud.setSessions(prev => prev.map(s =>
                    s.id === currentSessionId && s.memoryMode === "infinite"
                        ? { ...s, engineeringProjectRoot: project, updatedAt: Date.now() } : s))} />
            <SyncConflictModal
                isOpen={cloud.conflictModal.isOpen}
                cloudData={cloud.conflictModal.cloudData}
                localData={cloud.conflictModal.localData}
                reason={cloud.conflictModal.reason}
                onResolve={(choice: "cloud" | "local") => {
                    cloud.setConflictModal(prev => ({ ...prev, isOpen: false }));
                    void cloud.triggerSync(choice === "cloud" ? "force_pull" : "force_push");
                }}
            />
            <WorldInfoModal isOpen={ui.showLocalWorld} onClose={() => ui.setShowLocalWorld(false)}
                title={currentSession?.memoryMode === "infinite" ? `Officina · ${deepText(locale, "app.guideTitle")}`
                    : currentSession?.memoryMode === "sliding" ? `Via Lata · ${deepText(locale, "app.storyNotesTitle")}` : `Umbra · ${deepText(locale, "app.chatNotesTitle")}`}
                subtitle={currentSession?.memoryMode === "infinite"
                    ? deepText(locale, "app.guideSubtitle")
                    : currentSession?.memoryMode === "sliding"
                    ? deepText(locale, "app.storyNotesSubtitle")
                    : deepText(locale, "app.chatNotesSubtitle")}
                tone={currentSession?.memoryMode === "infinite" ? "engineering"
                    : currentSession?.memoryMode === "sliding" ? "story" : "chat"}
                content={currentSession?.localWorldInfo || ""}
                onSave={(value: string) => cloud.setSessions(prev => prev.map(s =>
                    s.id === currentSessionId ? { ...s, localWorldInfo: value, updatedAt: Date.now() } : s))} />

            <EditModal
                isOpen={ui.editModal.isOpen}
                onClose={() => ui.setEditModal({ ...ui.editModal, isOpen: false })}
                content={ui.editModal.text}
                setContent={(v: string) => ui.setEditModal({ ...ui.editModal, text: v })}
                onConfirm={() => {
                    if (!currentSession) return;
                    ui.setEditModal({ ...ui.editModal, isOpen: false });
                    engine.handleEditMessage(ui.editModal.index, ui.editModal.text);
                }}
            />

            <SaveLoadModal
                isOpen={ui.showSaveModal}
                onClose={() => ui.setShowSaveModal(false)}
                currentSession={currentSession}
                onLoadSession={(sess: any) => {
                    cloud.setSessions(prev => {
                        const idx = prev.findIndex(s => s.id === sess.id);
                        return idx !== -1 ? prev.map((s, i) => i === idx ? { ...sess, updatedAt: Date.now() } : s) : [{ ...sess, updatedAt: Date.now() }, ...prev];
                    });
                    setCurrentSessionId(sess.id);
                    ui.showToast(`Loaded: ${sess.title}`);
                }}
            />

            <SettingsCenter
                open={showSettingsCenter}
                onClose={() => setShowSettingsCenter(false)}
                values={config}
                onToggle={toggleSetting}
                debugMode={ui.debugMode}
                danmakuEnabled={config.danmakuEnabled}
                onToggleDanmaku={() => setConfig(prev => ({ ...prev, danmakuEnabled: !prev.danmakuEnabled }))}
                danmakuCount={config.danmakuCount}
                onDanmakuCountChange={(count: number) => setConfig(prev => ({ ...prev, danmakuCount: count }))}
                debugDrawTagsEnabled={config.debugDrawTags}
                onToggleDebugDrawTags={() => setConfig(prev => ({ ...prev, debugDrawTags: !prev.debugDrawTags }))}
                onToggleDebug={() => ui.setDebugMode(prev => !prev)}
                terminalRequestLogEnabled={config.terminalRequestLog}
                onToggleTerminalRequestLog={() => setConfig(prev => ({ ...prev, terminalRequestLog: !prev.terminalRequestLog }))}
                terminalLogEnabled={config.terminalLog}
                onToggleTerminalLog={() => setConfig(prev => ({ ...prev, terminalLog: !prev.terminalLog }))}
                engineeringTransitionEnabled={config.engineeringTransition}
                curtainTransitionEnabled={config.curtainTransition}
                onToggleCurtainTransition={() => setConfig(prev => ({ ...prev, curtainTransition: !prev.curtainTransition }))}
                    geminiNarrativeStyleEnabled={config.geminiNarrativeStyle}
                    engineeringLoreRelationshipsEnabled={config.engineeringLoreRelationships}
                    engineeringLoreExperiencesEnabled={config.engineeringLoreExperiences}
                    onToggleEngineeringLoreRelationships={() => setConfig(prev => ({ ...prev, engineeringLoreRelationships: !prev.engineeringLoreRelationships }))}
                    onToggleEngineeringLoreExperiences={() => setConfig(prev => ({ ...prev, engineeringLoreExperiences: !prev.engineeringLoreExperiences }))}
                    onToggleGeminiNarrativeStyle={() => setConfig(prev => ({ ...prev, geminiNarrativeStyle: !prev.geminiNarrativeStyle }))}
                onToggleEngineeringTransition={() => setConfig(prev => ({ ...prev, engineeringTransition: !prev.engineeringTransition }))}
                onTestEffect={ui.setEffect}
                isStory={currentSession?.memoryMode === 'sliding'}
                activeMode={currentSession?.memoryMode || "hub"}
                contextWindowTokens={config.contextWindowTokens}
                onContextWindowChange={(value) => setConfig(prev => ({ ...prev, contextWindowTokens: value }))}
                storyTheme={config.storyTheme}
                onStoryThemeChange={(value) => setConfig(prev => ({ ...prev, storyTheme: value }))}
                activeProvider={effectiveApiProvider}
                providers={displayProviders}
                disabledProviders={disabledProviders}
                onToggleProvider={toggleProviderDisabled}
                autoSync={syncPreferences.autoSync}
                autoSyncInterval={syncPreferences.autoSyncInterval}
                onAutoSyncChange={(autoSync) => updateSyncPreferences({ ...syncPreferences, autoSync })}
                onAutoSyncIntervalChange={(autoSyncInterval) => updateSyncPreferences({ ...syncPreferences, autoSyncInterval })}
                webToolConfig={config.webToolConfig}
                onWebToolConfigChange={(patch: Partial<WebToolConfig>) => setConfig(prev => ({ ...prev, webToolConfig: { ...prev.webToolConfig, ...patch } }))}
                providerAliases={providerAliases}
                onProviderAliasChange={(id: string, label: string) => setProviderAliases(prev => ({ ...prev, [id]: label.slice(0, 40) }))}
                imageSettings={config.imageSettings}
                onImageSettingsChange={(patch) => setConfig(prev => ({...prev, imageSettings: {...prev.imageSettings, ...patch}}))}
                providerCapabilities={providerCapabilities}
                onProviderCapabilitiesChange={(id, capability) => setProviderCapabilities(prev => ({ ...prev, [id]: { ...capabilityFor(id, prev), ...capability } }))}
                falConfigured={falConfigured}
                cloudCredentials={cloudCredentials}
                onCloudCredentialChange={updateCloudCredential}
                credentialVaultStatus={vaultStatus}
                credentialVaultBusy={vaultBusy}
                credentialVaultError={vaultError}
                credentialVaultDraft={vaultDraft}
                credentialVaultHasSaved={vaultHasSaved}
                credentialRuntimeUnlocked={runtimeUnlocked}
                onCredentialVaultSubmit={submitCloudVault}
                onCredentialVaultEdit={startVaultEditor}
                onCredentialVaultCancelEdit={cancelVaultEditor}
                onCredentialVaultDecrypt={decryptVaultForUse}
                onCredentialVaultClearMemory={clearRuntimeCredentials}
                onCredentialVaultReset={resetCloudVault}
            />
            <MemoryVaultModal
                open={showMemoryVault && currentSession?.memoryMode !== "infinite"}
                onClose={() => setShowMemoryVault(false)}
                sessionId={`${currentSession?.id || ""}${currentSession?.memoryMode === "chat" ? `:${activeCharacterId || "unselected"}` : ""}`}
                stm={currentSession?.memoryMode === "chat" ? currentSession.chatCharacterMemories?.[activeCharacterId]?.stm || "" : currentSession?.stm}
                ltm={currentSession?.memoryMode === "chat" ? currentSession.chatCharacterMemories?.[activeCharacterId]?.ltm || "" : currentSession?.ltm}
                tone={currentSession?.memoryMode === "sliding" ? "story" : currentSession?.memoryMode === "chat" ? "chat" : "engineering"}
                onSave={({ stm, ltm }) => {
                    if (!currentSession) return;
                    cloud.setSessions(prev => prev.map(s => s.id === currentSession.id
                        ? s.memoryMode === "chat" ? { ...s, chatCharacterMemories: { ...(s.chatCharacterMemories || {}), [activeCharacterId]: { stm, ltm } }, updatedAt: Date.now() }
                        : { ...s, stm, ltm, turnCount: stm.split(/\n/).filter(Boolean).length, updatedAt: Date.now() }
                        : s));
                    ui.showToast("Memory Vault saved");
                }}
            />
        </div>
    );
}