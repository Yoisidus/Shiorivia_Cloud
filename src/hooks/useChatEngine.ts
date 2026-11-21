import { useState, useRef, useEffect } from "react";
import { CHARACTERS, Session } from "../types";
import { formatLocalMemoryEntries, parseLocalMemoryEntries, LOCAL_STM_SLOTS } from "../lib/localMemory";
import { parseStoryTurnMemory, stripStoryTurnMemory } from "../lib/storyTurnMemory";
import { nextConversationMemory } from "../lib/conversationTurnMemory";
import { calculateNewStats } from "../lib/emotionalEngine";
import { uploadImageToCloud } from "../lib/cloudUtils";
import { buildDrawRequest } from "../lib/drawRequest";
import { parseDrawTag, cleanDrawTag } from "../lib/parseDraw"; 
import { useLanguage } from "../context/LanguageContext";
import { asChartaSelfPromptData, selfName } from "../lib/chartaSelf";
import { asChartaPromptData } from "../lib/charta";
import { parseStoryWorldline, enabledWorldIds, advanceWorldlineFromState } from "../lib/storyWorldline";
import { stripWorldlineAdvance } from "../lib/worldlineAdvanceProtocol";
import { extractNovelState, stripNovelState } from "../lib/novelState";
import { snapshotNovelState, restoreNovelState } from "../lib/novelStateRecovery";
import { stripNovelSuggestions } from "../lib/novelSuggestions";
import { storyCastAllowed, selectStoryCastIds } from "../lib/storyCast";
import { snapshotStoryState, restoreStoryState, emptyStoryState, isUsableStoryProtocol, normalizeStoryProtocol, storyProtocolIssues } from "../lib/storyStateRecovery";
import { completeStoryProtagonist } from "../lib/storyProtagonist";
import { mayReviewSessionTitle } from "../lib/titleReview";
import { extractInlineTitle } from "../lib/inlineTitle";
import { lastStoryGameState, storyProseWithoutState, stripStoryThinking } from "../lib/storyResponseProtocol";
import { aiConversationMessages, isEngineeringCharacterLocked } from "../lib/engineeringSession";
import { engineeringOutputIncomplete, OFFICINA_COMPLETION_REQUEST } from "../lib/engineeringCompletion";
import { extractIdeEditBlocks } from "../lib/ideEdits";
import { browserIde } from "../lib/browserIde";
import { validProjectName, validRelativePath, isWorkspaceTextFile } from "../lib/idePathPolicy";
import { deepText } from "../lib/i18nDeep";
import { useAppDialog } from "../context/DialogContext";

export const useChatEngine = ({
    currentSession, currentSessionId, setSessions,
    activeCharacterId, voiceVariant,
    config, 
    setTrackId, showToast, setIsGlobalGenerating,
    manualOutfitId,
    apiProvider, cloudCredentials = {}, customCharacters = [], customSelves = [], activeSelfId = null, storyWorlds = []
}: any) => {
    
    const { locale } = useLanguage();
    const dialog = useAppDialog();
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [storyStateRepairing, setStoryStateRepairing] = useState(false);
    const latestSessionRef = useRef<Session | null>(null);
    latestSessionRef.current = currentSession || null;
    const [selectedFile, setSelectedFile] = useState<{ url: string, type: 'image' | 'video' | 'text', name: string } | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [pendingStoryRegeneration, setPendingStoryRegeneration] = useState<{ sessionId: string; messagesLength: number } | null>(null);

    const stopGeneration = () => { 
        if (abortControllerRef.current) { 
            abortControllerRef.current.abort(); 
            setIsLoading(false); 
        } 
    };

    const handleSend = async (
        overrideInput?: string, 
        overrideMessages?: any[], 
        configOverride?: { 
            useMusicControl?: boolean; 
            novelConfig?: any;
            modelOverride?: string; 
        }
    ) => {
        if (isLoading || !currentSession) return;

        if ((currentSession.memoryMode === "sliding" || currentSession.memoryMode === "novel") && !parseStoryWorldline(currentSession.storyWorldline)) {
            showToast("请先打开右侧世界线，设置世界观、ERA 和 PERIOD，再开始故事。");
            return;
        }
        const isRegen = overrideMessages !== undefined;
        const modelToUse = (config.customModelId || config.selectedModel || "").trim();
        if (!modelToUse) {
            dialog.notify("请先在模型配置中选择当前供应商的模型，确认后再发送。");
            return;
        }
        const txt = overrideInput !== undefined ? overrideInput : input.trim();
        if (!isRegen && !txt && !selectedFile) return;
        if (currentSession.memoryMode === "chat") {
            const worldline = parseStoryWorldline(currentSession.storyWorldline);
            const char = [...CHARACTERS, ...customCharacters].find((item: any) => item.id === activeCharacterId);
            if (!worldline || !char || !storyCastAllowed(char, worldline)) {
                showToast("请先配置 Umbra 世界线，并从当前世界线选择一位聊天角色。");
                return;
            }
        }
        if (currentSession.memoryMode === "infinite") {
            const engineerId = currentSession.characterId || "";
            if (!engineerId || engineerId !== activeCharacterId ||
                ![...CHARACTERS, ...customCharacters].some((char: any) => char.id === engineerId)) {
                showToast("请先在右侧栏选择一位角色工程师，再发送消息。");
                return;
            }
            if (!isRegen && !isEngineeringCharacterLocked(currentSession)) {
                if (!await dialog.confirm("确认与当前角色开启 Officina 工程会话吗？\n发送第一条消息后，将永久绑定此角色，当前会话无法切换。")) return;
            }
        }
        // Only share browser IDE source with the selected model after explicit user approval.
        // This context is request-only: it is never persisted into chat history.
        let engineeringIdeContext: { project: string; files: {path: string; content: string}[] } | undefined;
        if (currentSession.memoryMode === "infinite" && currentSession.engineeringProjectRoot
            && /(?:code|fix|refactor|debug|implement|file|bug|source|function|project|edit|review|build|代码|文件|修改|修复|编写|实现|编辑|重构|工程|プロジェクト|コード|修正|파일|코드|수정|프로젝트)/i.test(txt)) {
            try {
                const snapshot = await browserIde("snapshot",{project:currentSession.engineeringProjectRoot});
                const entries = Object.entries(snapshot.files || {}) as [string,{content:string}][];
                const tokens = txt.toLowerCase().split(/[^a-z0-9_.\\/-]+/).filter(x=>x.length>2);
                entries.sort((a,b) => Number(tokens.some(t=>a[0].toLowerCase().includes(t))) * -1
                    + Number(tokens.some(t=>b[0].toLowerCase().includes(t))));
                const chosen: {path:string;content:string}[]=[];
                let remaining=32000;
                for (const [path,file] of entries) {
                    if (chosen.length>=8 || remaining<=1000) break;
                    if (typeof file?.content!=="string") continue;
                    const content=file.content.slice(0,Math.min(7500,remaining));
                    if (!content) continue;
                    chosen.push({path,content});
                    remaining-=content.length;
                }
                if (chosen.length && await dialog.confirm(
                    deepText(locale,"cloud.ide.shareConfirm")
                        .replace("{project}",currentSession.engineeringProjectRoot)
                        .replace("{count}",String(chosen.length)),
                    {tone:"officina"})) {
                    engineeringIdeContext={project:currentSession.engineeringProjectRoot,files:chosen};
                }
            } catch(error) {
                showToast(error instanceof Error ? error.message : deepText(locale,"cloud.ide.shareFailed"));
            }
        }
        const novelMode = currentSession.memoryMode === "novel";
        const novelLegacySelfId = novelMode && currentSession.storyRole === undefined ? currentSession.novelDraft?.selfId : null;
        const storyRole = (currentSession.memoryMode === "sliding" || novelMode)
            && (currentSession.storyRole === "participant" || (novelLegacySelfId && currentSession.storyRole !== "observer"))
            ? "participant" : "observer";
        const selectedSelfId = (novelMode ? (currentSession.storySelfId || novelLegacySelfId) : currentSession.storySelfId) || activeSelfId;
        const selectedSelf = storyRole === "participant"
            ? (currentSession.storySelfSnapshot || customSelves.find((self: any) => self.id === selectedSelfId))
            : null;
        if ((currentSession.memoryMode === "sliding" || novelMode) && storyRole === "participant" && !selectedSelf) {
            showToast("请先在 Charta 创建并启用一个自设，再开始参与模式");
            return;
        }
        if (novelMode && storyRole === "participant" && selectedSelf?.worldId
            && !enabledWorldIds(parseStoryWorldline(currentSession.storyWorldline)!).includes(selectedSelf.worldId)) {
            showToast("当前自设与小说世界线不匹配，请重新设置故事身份。");
            return;
        }
        const previousStoryTurns = (overrideMessages || currentSession.messages).filter((message: any) => message.role === "user").length;
        const generationId = crypto.randomUUID();
        const assistantMeta = {
            storyGenerationId: generationId,
            ...(currentSession.memoryMode === "sliding" ? { storyStateBefore: snapshotStoryState(currentSession) } : {}),
            ...(currentSession.memoryMode === "novel" ? { novelStateBefore: snapshotNovelState(currentSession, configOverride?.novelConfig) } : {}),
        };

        if (!isRegen) { setInput(""); setSelectedFile(null); }
        setIsLoading(true);

        let msgs = overrideMessages ? [...overrideMessages] : [...currentSession.messages];
        if ((currentSession.memoryMode === "infinite" || currentSession.memoryMode === "chat") && !isRegen) {
            // The unassigned welcome disappears from the conversation as soon as
            // its first real user message is submitted. Never send it to the model.
            msgs = msgs.filter(message => !(message.role === "assistant" && message.modelName === "System"));
        }
        // Model selection is global and provider-scoped; do not accept stale mode overrides.

        if (!isRegen) {
            let content: any = txt;
            if (selectedFile) {
                if (selectedFile.type === 'text') content = (txt ? txt + "\n\n" : "") + `[Attached File: ${selectedFile.name}]\n${selectedFile.url}`;
                else content = [{ type: "text", text: txt || "File" }, { type: "image_url", image_url: { url: selectedFile.url } }];
            }
            msgs.push({ role: "user", content, characterId: activeCharacterId, ...(currentSession.memoryMode === "sliding" ? { storyStateBefore: snapshotStoryState(currentSession) } : {}) });
        }

        setSessions((prev: any) => prev.map((s: any) => s.id === currentSessionId ? {
            ...s,
            messages: [...msgs, { role: "assistant", content: "", modelName: modelToUse, characterId: activeCharacterId, ...assistantMeta }],
            ...(s.memoryMode === "novel" && !s.novelInitialScene ? {
                novelInitialScene: {
                    environment: configOverride?.novelConfig?.environment ?? s.novelDraft?.environment ?? s.novelState?.environment ?? "",
                    event: configOverride?.novelConfig?.event ?? s.novelDraft?.event ?? s.novelState?.event ?? "",
                },
            } : {}),
            ...((s.memoryMode === "sliding" || s.memoryMode === "novel") ? {
                storyRole, storySelfId: storyRole === "participant" ? selectedSelf?.id || selectedSelfId : null,
                storySelfSnapshot: storyRole === "participant" ? selectedSelf : null,
                ...(s.memoryMode === "sliding" ? {
                    storyPovLocked: s.storyPovLocked || (Boolean(s.storyPovId) && (isRegen ? previousStoryTurns >= 2 : previousStoryTurns >= 1)),
                } : {}),
            } : {}),
            updatedAt: Date.now(),
            ...(s.memoryMode === "infinite" ? { engineeringCharacterLocked: true } : {}),
            voiceVariant
        } : s));

        abortControllerRef.current = new AbortController();

        // Shiorivia's initial system greeting stays visible in the interface but
        // must never be used as AI conversation context, including legacy saves.
        let payloadMessages = aiConversationMessages(msgs);

        try {
            const res = await fetch("/api/chat", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: payloadMessages.map((m: any) => ({ role: m.role, content: m.content, characterId: m.characterId })),
                    contextWindowTokens: config.contextWindowTokens,
                    model: modelToUse,
                    currentSessionTitle: currentSession.title,
                    titleReviewTurn: msgs.filter((m: any) => m.role === "user").length,
                    titleManuallyEdited: !mayReviewSessionTitle(currentSession, currentSession.memoryMode),
                    characterId: activeCharacterId,
                    variant: voiceVariant,
                    localWorldInfo: currentSession.localWorldInfo,
                    memoryMode: currentSession.memoryMode || 'sliding',
                    stm: currentSession.memoryMode === "infinite" ? "" : currentSession.memoryMode === "chat"
                        ? (currentSession.chatCharacterMemories?.[activeCharacterId]?.stm || "")
                        : currentSession.stm,
                    ltm: currentSession.memoryMode === "infinite" ? "" : currentSession.memoryMode === "chat"
                        ? (currentSession.chatCharacterMemories?.[activeCharacterId]?.ltm || "")
                        : currentSession.ltm,
                    timeline: currentSession.timeline,
                    storyWorldline: (currentSession.memoryMode === "sliding" || currentSession.memoryMode === "novel" || currentSession.memoryMode === "chat") ? currentSession.storyWorldline : undefined,
                    ...(currentSession.memoryMode === "chat" ? { chatCharacterMemories: currentSession.chatCharacterMemories || {} } : {}),
                    activeChartaSelf: (currentSession.memoryMode === "chat" || currentSession.memoryMode === "infinite") && activeSelfId
                        ? (() => { const self = customSelves.find((item: any) => item.id === activeSelfId); return self ? asChartaSelfPromptData(self) : null; })() : null,
                    novelConfig: configOverride?.novelConfig ?? (currentSession.memoryMode === "novel" ? {
                        environment: currentSession.novelDraft?.environment ?? currentSession.novelState?.environment ?? "",
                        event: currentSession.novelDraft?.event ?? currentSession.novelState?.event ?? "",
                        charNames: "", style: currentSession.novelDraft?.style ?? "",
                        outline: currentSession.novelDraft?.outline ?? currentSession.localWorldInfo ?? "",
                        selfId: currentSession.storySelfId ?? currentSession.novelDraft?.selfId ?? null,
                    } : undefined), 
                    useWebSearch: currentSession.memoryMode === "infinite" && config.webSearch,
                    webToolConfig: config.webToolConfig,
                    useMusicControl: ["sliding", "novel"].includes(currentSession.memoryMode)
                        && (configOverride?.useMusicControl ?? config.musicControl) === true,
                    useImageGen: ["sliding", "novel", "infinite", "chat"].includes(currentSession.memoryMode)
                        && config.imageGen === true,
                    danmakuEnabled: ["sliding", "novel"].includes(currentSession.memoryMode) && config.danmakuEnabled === true,
                    danmakuCount: Math.min(24, Math.max(1, Math.round(config.danmakuCount || 8))),
                    storyMemoryTurnCount: ["sliding", "novel"].includes(currentSession.memoryMode) ? currentSession.turnCount || 0 : undefined,
                    charStatus: currentSession.charStatus,
                    codeRepository: currentSession.engineeringProjectRoot ? undefined : currentSession.codeRepository,
                    engineeringProjectRoot: currentSession.memoryMode === "infinite" ? currentSession.engineeringProjectRoot || "" : "",
                    ...(engineeringIdeContext ? {engineeringIdeContext} : {}),
                    provider: apiProvider, byok: cloudCredentials[apiProvider], 
                    uiLanguage: locale,
                    debugRequestPayload: config.terminalRequestLog === true,
                    debugFullOutput: config.terminalLog === true,
                    geminiNarrativeStyle: config.geminiNarrativeStyle === true,
                    ...(currentSession.memoryMode === "novel" ? {
                        storyRole,
                        novelSelf: storyRole === "participant" && selectedSelf ? asChartaSelfPromptData(selectedSelf) : null,
                        storyNextCastIds: currentSession.storyNextCastIds ?? currentSession.novelDraft?.selectedCharIds ?? [],
                        storyAllowCrossWorld: currentSession.storyAllowCrossWorld === true,
                        storyCastWorlds: storyWorlds.map((world: any) => ({ id: world.id, name: world.name, description: world.description, canonTimeline: world.canonTimeline })),
                    } : {}),
                    ...(currentSession.memoryMode === "sliding" ? {
                        storyRole,
                        storyNextCastIds: currentSession.storyNextCastIds ?? currentSession.sceneCastIds ?? [],
                        storyAllowCrossWorld: currentSession.storyAllowCrossWorld === true,
                        storyCastWorlds: storyWorlds.map((world: any) => ({ id: world.id, name: world.name, description: world.description, canonTimeline: world.canonTimeline })),
                        storySelf: selectedSelf ? asChartaSelfPromptData(selectedSelf) : null,
                        storyPovId: storyRole === "observer" ? currentSession.storyPovId : null,
                        storyPovLocked: currentSession.storyPovLocked || (Boolean(currentSession.storyPovId) && (isRegen ? previousStoryTurns >= 2 : previousStoryTurns >= 1)),
                        previousProtagonist: currentSession.protagonist,
                    } : {}),
                    customCharacters: customCharacters.map(asChartaPromptData),
                    ...(currentSession.memoryMode === "infinite" ? {
                        engineeringLore: {
                            relationships: config.engineeringLoreRelationships === true,
                            experiences: config.engineeringLoreExperiences === true,
                        },
                        engineeringWorlds: storyWorlds.map((world: any) => ({
                            id: world.id, name: world.name, description: world.description,
                            canonTimeline: world.canonTimeline,
                        })),
                    } : {}),
                }),
                signal: abortControllerRef.current.signal
            });

            if (res.headers.get('X-Using-Main-Key') === 'true') {
                showToast("⚠️ Warning: Using Main Account Quota!");
            }

            if (!res.ok) throw new Error((await res.json()).error);
            // A server-side cast tool selects the profiles before narrative generation.
            const castHeader = res.headers.get("X-Shiorivia-Cast");
            let resolvedTurnCast: string[] | null = null;
            if (castHeader && (currentSession.memoryMode === "sliding" || currentSession.memoryMode === "novel")) {
                try {
                    const parsed: unknown = JSON.parse(castHeader);
                    if (Array.isArray(parsed) && parsed.every(id => typeof id === "string")) {
                        resolvedTurnCast = parsed;
                    }
                } catch { /* Older backend: retain the previous cast fields. */ }
            }
            if (!res.body) throw new Error("No response body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;

                setSessions((prev: any) => prev.map((s: any) => s.id === currentSessionId ? {
                    ...s, messages: [...msgs, { role: "assistant", content: extractInlineTitle(
                        currentSession.memoryMode === "sliding"
                            ? stripStoryThinking(fullText).replace(/<thinking\b[^>]*>[\s\S]*$/i, "")
                            : currentSession.memoryMode === "chat" ? stripWorldlineAdvance(fullText) : fullText
                    ).text.replace(/<turn_memory\s*>[\s\S]*?<\/turn_memory\s*>\s*/gi, "").replace(/<turn_memory\b[\s\S]*$/i, ""), modelName: modelToUse, characterId: activeCharacterId, ...assistantMeta }]
                } : s));
            }

            
            if (currentSession.memoryMode === "chat") fullText = stripWorldlineAdvance(fullText);
            if (currentSession.memoryMode === "sliding" || currentSession.memoryMode === "novel") fullText = stripStoryThinking(fullText);
            const titleFromSameGeneration = extractInlineTitle(fullText);
            fullText = titleFromSameGeneration.text;
            // Officina is now context-only. Old memory data remains in saved
            // sessions but is never injected or updated by new engineering turns.
            if (currentSession.memoryMode === "infinite") {
                fullText = fullText.replace(/<turn_memory\s*>[\s\S]*?<\/turn_memory\s*>\s*$/i, "").trimEnd();
            }
            if (titleFromSameGeneration.title && mayReviewSessionTitle(currentSession, currentSession.memoryMode)) {
                const proposal = titleFromSameGeneration.title;
                const expectedUserTurns = msgs.filter((m: any) => m.role === "user").length;
                const oldTitle = currentSession.title;
                setSessions((prev: Session[]) => prev.map(s => s.id === currentSessionId
                    && s.title === oldTitle && mayReviewSessionTitle(s, s.memoryMode)
                    && s.messages.filter(m => m.role === "user").length === expectedUserTurns
                    && s.messages.some(m => m.storyGenerationId === generationId)
                        ? { ...s, title: proposal, titleAutoManaged: true } : s));
            }

            if (currentSession.memoryMode === "chat") {
                // The visible reply never includes private memory metadata.
                const inlineMemory = parseStoryTurnMemory(fullText);
                fullText = stripStoryTurnMemory(fullText);
                const originalMemory = currentSession.chatCharacterMemories?.[activeCharacterId] || { stm: "", ltm: "" };
                const inlineApplied = !isRegen && inlineMemory?.stm
                    ? nextConversationMemory(originalMemory, inlineMemory) : null;
                const needsFallback = !isRegen && Boolean(fullText.trim()) &&
                    (!inlineMemory?.stm || (parseLocalMemoryEntries(originalMemory.stm).length >= 6 && !inlineMemory.ltm));
                setSessions((prev: Session[]) => prev.map(s => {
                    if (s.id !== currentSessionId || s.memoryMode !== "chat") return s;
                    const memory = s.chatCharacterMemories?.[activeCharacterId] || { stm: "", ltm: "" };
                    const canApply = inlineApplied && memory.stm === originalMemory.stm
                        && memory.ltm === originalMemory.ltm;
                    return {
                        ...s,
                        messages: [...msgs, { role: "assistant", content: fullText, modelName: modelToUse,
                            characterId: activeCharacterId, ...assistantMeta,
                            metadataRepairMissing: Boolean(needsFallback), memoryRepairMissing: Boolean(needsFallback) }],
                        ...(canApply ? { chatCharacterMemories: {
                            ...(s.chatCharacterMemories || {}),
                            [activeCharacterId]: { stm: inlineApplied.stm, ltm: inlineApplied.ltm },
                        } } : {}),
                        updatedAt: Date.now(),
                    };
                }));

                if (needsFallback) showToast("本轮聊天记忆不完整，可点击「补齐状态」手动恢复。");
                return;
            }

            // DeepSeek and other compatible gateways occasionally finish after the
            // narrative but before the trailing structured state. Ask for ONE brief
            // state-only extraction; do not regenerate/overwrite the story prose.
            let storyProtocolMissing = false;
            const existingGameBlock = lastStoryGameState(fullText);
            let validGameJson = false;
            if (existingGameBlock) {
                try {
                    const value = normalizeStoryProtocol(JSON.parse(existingGameBlock.json));
                    const issues = storyProtocolIssues(value);
                    validGameJson = issues.length === 0;
                    if (issues.length) console.warn("Story state recovery required, missing fields:", issues);
                } catch (error) { console.warn("Rejected story state JSON (repair if needed):", error); }
            }
            if (currentSession.memoryMode === "sliding" && !validGameJson) {
                // Preserve prose and the previous valid state. Manual completion is
                // available on this assistant bubble; it never runs invisibly.
                storyProtocolMissing = true;
                showToast("本轮故事状态不完整；可以点击消息下方的「补齐状态」。");
            }
            let currentText = fullText;
            let novelState = currentSession.memoryMode === "novel" ? extractNovelState(fullText) : null;
            let novelDanmaku: string[] = [];
            if (currentSession.memoryMode === "novel" && config.danmakuEnabled === true) {
                // New chapters embed danmaku in novel_state. Read older standalone
                // novel_danmaku blocks only for archived/older provider replies.
                novelDanmaku = Array.isArray(novelState?.danmaku)
                    ? novelState.danmaku.slice(0, Math.min(24, Math.max(1, config.danmakuCount || 8))) : [];
                const match = novelDanmaku.length ? null : fullText.match(/<novel_danmaku\s*>([\s\S]*?)<\/novel_danmaku\s*>/i);
                if (match) {
                    try {
                        const parsed: unknown = JSON.parse(match[1]);
                        if (Array.isArray(parsed)) novelDanmaku = parsed.filter(item => typeof item === "string")
                            .map(item => item.trim().slice(0, 120)).filter(Boolean).slice(0, Math.min(24, Math.max(1, config.danmakuCount || 8)));
                    } catch { /* Preserve prose when an optional extension is malformed. */ }
                }
            }

            if (currentSession.memoryMode === "novel") {
                // A malformed or missing chapter state must never erase the last good state.
                if (!novelState) {
                    showToast("本章没有返回完整的 novel_state：正文已保留，环境和事件未更新。");
                } else {
                    const worldline = parseStoryWorldline(currentSession.storyWorldline);
                    const allowed = new Set([...CHARACTERS, ...customCharacters].filter((char: any) =>
                        worldline && storyCastAllowed(char, worldline)
                    ).map((char: any) => char.id as string));
                    // novel_state.nextSceneCastIds is a legacy wire field and stays
                    // separate from the model tool's CURRENT chapter cast.
                    // Only save eligible IDs for the current cast on the session.
                    if (resolvedTurnCast) resolvedTurnCast = selectStoryCastIds(resolvedTurnCast, allowed);
                }
                currentText = stripNovelState(currentText);
                // The session title and chapter title are generated in the
                // SAME response. Keep the first chapter's meta aligned when
                // the new session title was reviewed this turn.
                if (titleFromSameGeneration.title && mayReviewSessionTitle(currentSession, "novel")) {
                    const safeTitle = titleFromSameGeneration.title.replace(/["<>]/g, "").slice(0, 100);
                    currentText = currentText.replace(/^(\s*<meta\s+title=)["'][^"']+["'](?=\s+chapter=)/i,
                        (_match: string, prefix: string) => `${prefix}"${safeTitle}"`);
                }
                // A provider may omit <meta> on continuations even when instructed.
                // Keep the chapter readable and titled without changing manual session titles.
                const chapterMeta = /^\s*<meta\s+title=["'][^"']+["']\s+chapter=["'][^"']+["']\s*\/\s*>/i;
                if (currentText.trim() && !chapterMeta.test(currentText)) {
                    const earlier = [...msgs].reverse().find((m: any) =>
                        m.role === "assistant" && typeof m.content === "string" &&
                        /<meta\s+title=["'][^"']+["']\s+chapter=["'][^"']+["']\s*\//i.test(m.content));
                    const previousTitle = earlier?.content?.match(/<meta\s+[^>]*chapter=["']([^"']+)["']/i)?.[1];
                    const chapterCount = msgs.filter((m: any) => m.role === "assistant" &&
                        typeof m.content === "string" && m.content.includes("<meta ")).length + 1;
                    const fallbackTitle = previousTitle || `第 ${chapterCount} 章`;
                    // Never schedule a second model request for a missing chapter
                    // title. Reuse the preceding chapter title only as a local
                    // last-resort fallback; normal models must emit their own.
                    const chapterTitle = fallbackTitle;
                    const title = String(currentSession.title || "小说").replace(/["<>]/g, "").slice(0, 100);
                    const chapter = String(chapterTitle).replace(/["<>]/g, "").slice(0, 100);
                    currentText = `<meta title="${title}" chapter="${chapter}" />\n${currentText.trim()}`;
                }
            }
            let capturedState: any = null;
            let newFiles: Record<string, any> = {};

            const drawCmd = parseDrawTag(currentText);
            
            if (false && drawCmd && drawCmd.trigger && config.imageGen) { // Legacy auto-render path disabled; requests require user confirmation.
                const targetDrawTag = `<draw>${currentText.match(/<draw>([\s\S]*?)<\/draw>/)?.[1] || ""}</draw>`;

                (async () => {
                    try {
                        setIsGlobalGenerating(true);
                        
                        const subjectId = drawCmd.charId || activeCharacterId;
                        const subjectName = customCharacters.find((c: any) => c.id === subjectId)?.names?.[locale]
                            || CHARACTERS.find(c => c.id === subjectId)?.name || subjectId;
                        const rawStatus = currentSession?.charStatus;
                        const subjectStatus = Array.isArray(rawStatus)
                            ? rawStatus.find((s: any) => s?.name === subjectName) || rawStatus[0]
                            : rawStatus;
                        const appearance = [subjectStatus?.clothing, subjectStatus?.bodyState, subjectStatus?.innerState]
                            .filter((item: unknown) => typeof item === 'string').join('; ').slice(0, 600);
                        const scenePrompt = [drawCmd.description, `character: ${subjectName}`,
                            `outfit: ${drawCmd.outfitId || manualOutfitId || 'default'}`,
                            appearance ? `current state: ${appearance}` : ''].filter(Boolean).join(', ');
                        const drawPayload = {
                            outfitId: drawCmd.outfitId || manualOutfitId || "casual", 
                            charId: drawCmd.charId || activeCharacterId,
                            description: scenePrompt,
                            provider: config.imageSettings?.provider || 'comfyui',
                            model: config.imageSettings?.model || '',
                            positive: config.imageSettings?.positive || '',
                            negative: config.imageSettings?.negative || '',
                            width: config.imageSettings?.width,
                            height: config.imageSettings?.height,
                            steps: config.imageSettings?.steps,
                            cfg: config.imageSettings?.cfg
                        };

                        const configRes = await fetch("/api/draw", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({...drawPayload, byok:cloudCredentials[drawPayload.provider || ""]})
                        });
                        
                        const drawData = await configRes.json();
                        
                        if (drawData.success && drawData.image) {
                            const url = await uploadImageToCloud(drawData.image, drawData.meta);
                            
                            if (url) {
                                setSessions((prev: any) => prev.map((s: any) => {
                                    if (s.id !== currentSessionId) return s;
                                    
                                    const newMessages = s.messages.map((m: any) => {
                                        if (typeof m.content === 'string' && m.content.includes(targetDrawTag)) {
                                            const logTag = targetDrawTag.replace('<draw>', '<draw_log>').replace('</draw>', '</draw_log>');
                                            
                                            const newContent = m.content.replace(
                                                targetDrawTag, 
                                                `${logTag}\n\n![Generated](${url})\n`
                                            );
                                            return { ...m, content: newContent };
                                        }
                                        return m;
                                    });

                                    return { ...s, messages: newMessages };
                                }));
                                showToast("🎨 Render Complete");
                            }
                        } else {
                            showToast(`❌ Render Failed: ${drawData.error || 'Unknown image error'}`);
                        }
                    } catch (e) { 
                        console.error("Auto-Draw Failed:", e); 
                        showToast("❌ Render Failed");
                    } finally { 
                        setIsGlobalGenerating(false); 
                    }
                })();
            }

            const audioRegex = /<audio>(.*?)<\/audio>/;
            const audioMatch = currentText.match(audioRegex);
            if (audioMatch) {
                try {
                    const audioData = JSON.parse(audioMatch[1]);
                    if (setTrackId && (audioData.name || audioData.trackId))
                        setTrackId(audioData.name || audioData.trackId, audioData.artist);
                    currentText = currentText.replace(audioRegex, "");
                } catch(e) { console.error("Audio Parse Error", e); }
            }

            const gameRegex = /<game_state>([\s\S]*?)<\/game_state>/i;
            const gameMatch = currentSession.memoryMode === "sliding" ? lastStoryGameState(currentText) : currentText.match(gameRegex);
            if (currentSession.memoryMode === "novel") {
                // Novel owns <novel_state>; a stray Story protocol must not mutate
                // novel character/status fields or leak into the reading view.
                currentText = currentText.replace(gameRegex, "").trim();
            }
            if (gameMatch && currentSession.memoryMode === "sliding") {
                try {
                    const parsed = normalizeStoryProtocol(JSON.parse("json" in gameMatch ? gameMatch.json : gameMatch[1]));
                    currentText = storyProseWithoutState(currentText).trim();
                    if (currentSession.memoryMode === "sliding" && !isUsableStoryProtocol(parsed)) {
                        throw new Error("Incomplete game_state JSON: " + storyProtocolIssues(parsed).join("; "));
                    }
                    capturedState = parsed;

                    if (currentSession.memoryMode === "sliding") {
                        const worldline = parseStoryWorldline(currentSession.storyWorldline);
                        const catalog = [...CHARACTERS, ...customCharacters.map((c: any) => ({ id: c.id, name: c.names?.[locale] || c.names?.[c.primaryLanguage] || c.id, worldId: c.worldId }))]
                            .filter(char => worldline && storyCastAllowed(char, worldline));
                        const knownCast = new Set(catalog.map(c => c.id));
                        // Deprecated nextSceneCastIds is a wire-compatibility field;
                        // the next generation always runs an independent cast lookup.
                        // Its value must never be mistaken for the CURRENT cast.
                        capturedState.nextSceneCastIds = [];
                        const rawIds = Array.isArray(capturedState.sceneCastIds)
                            ? capturedState.sceneCastIds.filter((id: unknown) => typeof id === "string" && knownCast.has(id as string)) : [];
                        const normalizedProse = currentText.replace(/\s+/g, "");
                        const namedInProse = catalog.filter((c: any) => {
                            const alternatives = [c.name, ...Object.values(customCharacters.find((item: any) => item.id === c.id)?.names || {})];
                            return alternatives.some((name: unknown) => typeof name === "string" && name.trim().length >= 2
                                && normalizedProse.includes(name.replace(/\s+/g, "")));
                        }).map(c => c.id);
                        const legacyIds = (Array.isArray(capturedState.character) ? capturedState.character : []).flatMap((s: any) => {
                            const match = catalog.find(c => c.name === s?.name);
                            return match ? [match.id] : [];
                        });
                        // Prefer an explicit on-stage list; for older models, fall back
                        // to names actually mentioned in the visible story.
                        capturedState.sceneCastIds = [...new Set(rawIds.length ? rawIds : namedInProse.length ? namedInProse : legacyIds)];
                        if (storyRole === "observer" && !currentSession.storyPovId) {
                            // No player-character status exists until a POV is selected.
                            capturedState.protagonist = undefined;
                            capturedState.character = undefined;
                        } else {
                            const chosenPov = catalog.find(c => c.id === currentSession.storyPovId);
                            if (storyRole === "participant" && selectedSelf) {
                                capturedState.protagonist = completeStoryProtagonist({
                                    raw: capturedState.protagonist, previous: currentSession.protagonist,
                                    name: selfName(selectedSelf, locale),
                                    environment: capturedState.environment,
                                    era: currentSession.storyWorldline?.era, period: currentSession.storyWorldline?.period,
                                });
                            } else if (chosenPov) {
                                const povStats = (Array.isArray(capturedState.character) ? capturedState.character : [])
                                    .find((item: any) => item?.name === chosenPov.name);
                                capturedState.protagonist = completeStoryProtagonist({
                                    raw: capturedState.protagonist, previous: currentSession.protagonist,
                                    currentCharacter: povStats, name: chosenPov.name,
                                    environment: capturedState.environment,
                                    era: currentSession.storyWorldline?.era, period: currentSession.storyWorldline?.period,
                                });
                            }
                            const oldStats = Array.isArray(currentSession.charStatus) ? currentSession.charStatus : currentSession.charStatus ? [currentSession.charStatus] : [];
                            const newStats = Array.isArray(capturedState.character) ? capturedState.character : capturedState.character ? [capturedState.character] : [];
                            // A model may echo the participant self (or observer POV) in character[].
                            // Match both IDs and all localized self names before applying relationship scores.
                            const ownerIdentities = storyRole === "participant" && selectedSelf
                                ? [selectedSelf.id, ...Object.values(selectedSelf.names || {})]
                                : chosenPov ? [chosenPov.id, chosenPov.name] : [];
                            const normalizedIdentity = (value: unknown) => typeof value === "string"
                                ? value.replace(/\s+/g, "").toLocaleLowerCase() : "";
                            const excluded = new Set(ownerIdentities.map(normalizedIdentity).filter(Boolean));
                            const knownNames = new Set([
                                ...catalog.map(char => char.name),
                                ...customCharacters.filter((char: any) => knownCast.has(char.id))
                                    .flatMap((char: any) => Object.values(char.names || {})),
                            ].map(normalizedIdentity).filter(Boolean));
                            capturedState.character = newStats.filter((stats: any) =>
                                stats && typeof stats === "object" &&
                                (knownCast.has(stats.id) || knownNames.has(normalizedIdentity(stats.name))) &&
                                !excluded.has(normalizedIdentity(stats.id)) &&
                                !excluded.has(normalizedIdentity(stats.name)))
                                .map((stats: any) => {
                                    const prev = oldStats.find((item: any) => item.name === stats.name);
                                    const previousMetrics = {
                                         affection: Number(prev?.affection) || 0,
                                         Possessiveness: Number(prev?.Possessiveness) || 0,
                                         Obsession: Number(prev?.Obsession) || 0,
                                         Lust: Number(prev?.Lust ?? prev?.Intimacy) || 0,
                                     };
                                     // Missing score fields mean "unchanged", not 0.
                                     // A state-only extraction may supply favorability and trust,
                                     // but only favorability has a defined mapping to affection.
                                     const suggestedMetrics = Object.fromEntries(
                                         (["affection", "Possessiveness", "Obsession", "Lust"] as const)
                                             .map(key => [key, typeof stats[key] === "number" && Number.isFinite(stats[key])
                                                 ? stats[key] : previousMetrics[key]]),
                                     ) as typeof previousMetrics;
                                     const damped = calculateNewStats(previousMetrics, suggestedMetrics);
                                    const updated = { ...prev, ...stats,
                                        affection: damped.affection, Possessiveness: damped.Possessiveness,
                                        Obsession: damped.Obsession, Lust: damped.Lust };
                                    // Static biography and retired renderer fields are not relationship state.
                                    for (const key of ["age", "gender", "environment", "timeDesc", "live2d", "effect"]) delete updated[key];
                                    return updated;
                                });
                        }
                    }

                    if (false && capturedState.imageGen?.trigger && config.imageGen) { // No automatic rendering from legacy game_state.
                        setIsGlobalGenerating(true);
                        showToast("🎨 Visualizer: Rendering...");
                        
                        (async () => {
                            try {
                                const drawPayload = {
                                    charId: capturedState.imageGen.charId || activeCharacterId,
                                    outfitId: capturedState.imageGen.outfitId || manualOutfitId || "casual",
                                    
                                    description: (capturedState.imageGen.emotion || "") + ", " + (capturedState.imageGen.description || ""),
                                    
                                    negativePrompt: capturedState.imageGen.negativePrompt, 
                                    ...capturedState.imageGen.parameters 
                                };

                                const configRes = await fetch("/api/draw", {
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({...drawPayload, byok:cloudCredentials[drawPayload.provider || ""]})
                                });
                                const drawData = await configRes.json();
                                
                                if (drawData.success && drawData.image) {
                                    const url = await uploadImageToCloud(drawData.image, drawData.meta);
                                    if (url) {
                                        setSessions((prev: any) => prev.map((s: any) => s.id === currentSessionId ? {
                                            ...s, messages: s.messages.map((m: any, i: number) => i === s.messages.length - 1 ? { ...m, content: currentText + `\n\n![Visual](${url})` } : m)
                                        } : s));
                                        showToast("🎨 Scene Captured");
                                    }
                                }
                            } catch (e) { console.error(e); }
                            finally { setIsGlobalGenerating(false); }
                        })();
                    }

                    // Do not turn legacy game_state.imageGen into a <draw> command.
                    // Draw placeholders now require an explicit AI-selected image
                    // tool and a complete <draw> protocol block in the reply.

                    if (["sliding", "novel"].includes(currentSession.memoryMode) && config.musicControl && capturedState.music?.trigger && (capturedState.music?.name || capturedState.music?.trackId) && setTrackId) {
                        setTimeout(() => setTrackId(capturedState.music.name || capturedState.music.trackId, capturedState.music.artist), 500);
                    }

                } catch (e) { console.error("Game State Error", e); }
            }


            const inlineStoryMemory = ["sliding", "novel"].includes(currentSession.memoryMode)
                ? parseStoryTurnMemory(currentText) : null;
            if (storyProtocolMissing && currentSession.memoryMode === "sliding") {
                // The user sees fiction, not a broken trailing JSON block.
                currentText = storyProseWithoutState(currentText);
            }
            const incompleteMemory = ["sliding", "novel"].includes(currentSession.memoryMode)
                && (!inlineStoryMemory?.stm || ((currentSession.turnCount || 0) >= 6 && !inlineStoryMemory.ltm));
            if (currentSession.memoryMode === "sliding" || currentSession.memoryMode === "novel")
                currentText = stripStoryTurnMemory(currentText);

            // Keep IDE result metadata separate from the model's prose.
            const ideEditedFiles: { path: string; operations: number; added: number; removed: number }[] = [];
            // Model-authored local edits are compact line operations, not complete files.
            // The server validates every anchor; a preview and browser confirmation
            // precede any write. Never send patch operations outside the bound project.
            if (currentSession.memoryMode === "infinite" && /<\/?ide_edit\b/i.test(currentText)) {
                try {
                    if (!currentSession.engineeringProjectRoot) throw new Error("请先绑定 IDE 项目才能局部修改代码。");
                    const parsed = extractIdeEditBlocks(currentText);
                    currentText = parsed.text;
                    const ideEditRequest = (action: "previewEdit" | "applyEdit", args: Record<string, unknown>) =>
                        browserIde(action, {project:currentSession.engineeringProjectRoot,...args});
                    const previews: Array<{ path: string; version: string; edits: typeof parsed.blocks[number]["edits"] }> = [];
                    for (const block of parsed.blocks) {
                        const preview = await ideEditRequest("previewEdit", { path: block.path, edits: block.edits });
                        previews.push({ path: block.path, version: preview.version, edits: block.edits });
                    }
                    if (previews.length && await dialog.reviewEdits(previews)) {
                        const applied: string[] = [];
                        try {
                            for (const file of previews) {
                                await ideEditRequest("applyEdit", {
                                    path: file.path, version: file.version, edits: file.edits,
                                });
                                applied.push(file.path);
                                let added = 0;
                                let removed = 0;
                                for (const edit of file.edits) {
                                    const originalLines = edit.expected.split("\n").length;
                                    const newLines = edit.text?.split("\n").length || 0;
                                    if (edit.op === "replace") { added += newLines; removed += originalLines; }
                                    else if (edit.op === "delete") removed += originalLines;
                                    else added += newLines;
                                }
                                ideEditedFiles.push({ path: file.path, operations: file.edits.length, added, removed });
                            }
                            showToast(`已在浏览器 IDE 修改 ${applied.length} 个文件`);
                        } catch (editError: any) {
                            currentText += `\n\n**IDE 局部修改未全部应用：** 已修改 ${applied.join(", ") || "无"}；${editError.message}`;
                            dialog.notify(`IDE 局部编辑失败：${editError.message}`);
                        }
                    } else if (previews.length) {
                        currentText += "\n\n*IDE 局部修改已取消，浏览器项目文件未更改。*";
                    }
                } catch (editError: any) {
                    console.warn("IDE edit rejected:", editError);
                    currentText += `\n\n**IDE 局部修改未执行：** ${editError.message}`;
                    dialog.notify(`无法应用 IDE 局部修改：${editError.message}`);
                }
            }

            const fileRegex = /<file name="(.*?)">([\s\S]*?)<\/file>/g;
            currentText = currentText.replace(fileRegex, (match, fileName, fileContent) => {
                const ext = fileName.split('.').pop()?.toLowerCase() || '';
                if (['txt', 'md', 'markdown', 'log'].includes(ext) && fileName.toLowerCase() !== 'requirements.txt') {
                    return `\n**[Document: ${fileName}]**\n\`\`\`${ext}\n${fileContent}\n\`\`\`\n`;
                }
                newFiles[fileName] = { name: fileName, language: ext || 'text',
                    content: fileContent.replace(/^\r?\n/, "").replace(/\r?\n$/, "") };
                return ""; 
            }).trim();

            // AI-produced source is saved only into this browser's virtual IDE root,
            // never into any server's filesystem or other user's session.
            let outputProject = currentSession.memoryMode === "infinite"
                ? String(currentSession.engineeringProjectRoot || "") : "";
            let diskWriteSucceeded = false;
            if (currentSession.memoryMode === "infinite" && Object.keys(newFiles).length) {
                const rootTag = currentText.match(/<project\s+name=["']([^"']+)["']\s*\/\s*>/i);
                currentText = currentText.replace(/<project\s+name=["'][^"']+["']\s*\/\s*>/gi, "").trim();
                try {
                    // Validate all generated paths before approval; never create an
                    // unbound project or write even one file without consent.
                    const generated = Object.entries(newFiles) as [string, { content: string }][];
                    for (const [path] of generated) {
                        if (!isWorkspaceTextFile(validRelativePath(path))) {
                            throw new Error("Unsupported browser IDE path: " + path);
                        }
                    }
                    const creatingProject = !outputProject;
                    let targetProject = outputProject;
                    if (creatingProject) {
                        const suffix = String(currentSessionId).replace(/[^a-zA-Z0-9_-]/g, "").slice(-10) || "new";
                        const fallback = `officina-${suffix}`;
                        let preferred = rootTag?.[1]?.trim() || fallback;
                        const listed = await browserIde("projects");
                        if (Array.isArray(listed.projects) && listed.projects.includes(preferred)) {
                            preferred = `${preferred.slice(0, 75)}-${suffix}`;
                        }
                        targetProject = validProjectName(preferred);
                    }
                    const existingFiles: Record<string, { content: string }> = creatingProject
                        ? {} : (await browserIde("snapshot", { project: targetProject })).files || {};
                    const expected: Record<string, string | null> = {};
                    const contents: Record<string, string> = {};
                    let replacements = 0;
                    const preview: string[] = [];
                    for (const [path, file] of generated) {
                        const previous = Object.prototype.hasOwnProperty.call(existingFiles, path)
                            ? existingFiles[path]?.content ?? null : null;
                        expected[path] = previous;
                        contents[path] = file.content;
                        if (previous !== null) replacements++;
                        preview.push(`${previous === null ? "+" : "~"} ${path}\n${file.content.slice(0, 1800)}${file.content.length > 1800 ? "\n…" : ""}`);
                    }
                    const confirmation = deepText(locale, "cloud.ide.writeConfirm")
                        .replace("{project}", targetProject)
                        .replace("{count}", String(generated.length))
                        .replace("{create}", String(generated.length - replacements))
                        .replace("{replace}", String(replacements));
                    if (!await dialog.confirm(confirmation, {
                        tone: "officina", preview: preview.join("\n\n").slice(0, 14000),
                    })) {
                        currentText += "\n\n" + deepText(locale, "cloud.ide.writeCancelled");
                    } else {
                        if (creatingProject) {
                            const created = await browserIde("createProject", { name: targetProject });
                            targetProject = created.project;
                        }
                        // Reject stale changes; write all approved files in one
                        // browser transaction rather than partially saving a set.
                        await browserIde("writeBatch", { project: targetProject, files: contents, expected });
                        outputProject = targetProject;
                        diskWriteSucceeded = true;
                        showToast(`已保存到浏览器 IDE/${outputProject} · ${generated.length} 个文件`);
                    }
                } catch (error: any) {
                    console.warn("Officina project write failed:", error);
                    showToast(`IDE 文件写入失败；代码已附在回复下方：${error.message}`);
                    currentText += "\n\n**[IDE 文件未全部保存 · 以下是生成的源码备份]**\n"
                        + Object.entries(newFiles).map(([name, file]: [string, any]) =>
                            `\n**${name}**\n\x60\x60\x60${file.language || "text"}\n${file.content}\n\x60\x60\x60`
                        ).join("\n");
                }
            } else if (currentSession.memoryMode === "infinite") {
                currentText = currentText.replace(/<project\s+name=["'][^"']+["']\s*\/\s*>/gi, "").trim();
            }

            setSessions((prev: any) => prev.map((s: any) => {
                if (s.id === currentSessionId) {
                    const oldRepo = s.codeRepository || {};
                    const updatedRepo = diskWriteSucceeded && outputProject
                        ? oldRepo : { ...oldRepo, ...newFiles };

                    return {
                        ...s,
                        ...(s.memoryMode === "infinite" && outputProject
                            ? { engineeringProjectRoot: outputProject } : {}),
                        messages: [...msgs, { role: "assistant", content: currentText, modelName: modelToUse, characterId: activeCharacterId, ...assistantMeta, storyProtocolMissing,
                            metadataRepairMissing: (s.memoryMode === "novel" && (!novelState || !novelState.choices)) || incompleteMemory,
                            memoryRepairMissing: incompleteMemory,
                            novelStateRepairMissing: s.memoryMode === "novel" && (!novelState || !novelState.choices),
                            ...(storyProtocolMissing && inlineStoryMemory ? { storyPendingMemory: inlineStoryMemory } : {}),
                            ...(s.memoryMode === "novel" && novelState?.choices ? { novelChoices: novelState.choices } : {}),
                            ...(s.memoryMode === "novel" ? { novelDanmaku } : {}),
                            ...(ideEditedFiles.length ? { ideEditedFiles } : {}) }],
                        codeRepository: updatedRepo,
                        ...(s.memoryMode === "novel" ? { lastDanmaku: config.danmakuEnabled ? novelDanmaku : [] } : {}),
                        ...(s.memoryMode === "sliding" && resolvedTurnCast ? { storyNextCastIds: resolvedTurnCast } : {}),
                        ...(s.memoryMode === "novel" && resolvedTurnCast ? { storyNextCastIds: resolvedTurnCast } : {}),
                        ...(s.memoryMode === "novel" && novelState ? {
                            novelState: s.storyWorldline ? {
                                ...novelState,
                                era: advanceWorldlineFromState(s.storyWorldline, novelState).era,
                                period: advanceWorldlineFromState(s.storyWorldline, novelState).period,
                            } : novelState,
                            ...(s.storyWorldline ? { storyWorldline: advanceWorldlineFromState(s.storyWorldline, novelState) } : {}),
                            // Keep the current cast visible in the CAST picker.
                            // Do not overwrite it with the intentionally empty
                            // nextSceneCastIds legacy property from novel_state.
                            storyNextCastIds: resolvedTurnCast ?? s.storyNextCastIds ?? [],
                            novelDraft: {
                                ...(s.novelDraft || {}),
                                environment: novelState.environment,
                                event: novelState.event,
                                selectedCharIds: resolvedTurnCast ?? s.storyNextCastIds ?? [],
                            },
                        } : {}),
                        ...(capturedState ? {
                            protagonist: capturedState.protagonist,
                            charStatus: capturedState.character,
                            ...(s.memoryMode === "sliding" ? {
                                sceneCastIds: capturedState.sceneCastIds || [],
                                storyNextCastIds: resolvedTurnCast ?? s.storyNextCastIds ?? [],
                            } : {}),
                            plotSuggestions: capturedState.suggestions,
                            lastDanmaku: config.danmakuEnabled && Array.isArray(capturedState.danmaku)
                                ? capturedState.danmaku.filter((item: unknown): item is string => typeof item === "string")
                                    .map((item: string) => item.trim().slice(0, 120)).filter(Boolean)
                                    .slice(0, Math.min(24, Math.max(1, config.danmakuCount || 8)))
                                : [],
                            timeline: s.storyWorldline
                                ? { ...capturedState.timeline,
                                    era: advanceWorldlineFromState(s.storyWorldline, capturedState.timeline).era,
                                    period: advanceWorldlineFromState(s.storyWorldline, capturedState.timeline).period }
                                : capturedState.timeline,
                            ...(s.memoryMode === "sliding" && s.storyWorldline
                                ? { storyWorldline: advanceWorldlineFromState(s.storyWorldline, capturedState.timeline) } : {}),
                            
                            // Background/Live2D state remains readable from legacy saves, but
                            // new story replies no longer supply those retired automation fields.
                            currentOutfitId: capturedState.imageGen?.outfitId || s.currentOutfitId 
                        } : {})
                    };
                }
                return s;
            }));

            if (currentSession.memoryMode === "infinite") {
                const lastPrompt = [...msgs].reverse().find((message: any) => message.role === "user");
                const requestText = typeof lastPrompt?.content === "string" ? lastPrompt.content : "";
                if (engineeringOutputIncomplete(requestText, currentText)) {
                    setSessions((prev: Session[]) => prev.map(s => s.id === currentSessionId ? {
                        ...s, messages: s.messages.map(m => m.storyGenerationId === generationId
                            && m.role === "assistant" ? { ...m, engineeringOutputIncomplete: true } : m),
                    } : s));
                }
            }
            if (["sliding", "novel"].includes(currentSession.memoryMode) && !storyProtocolMissing && inlineStoryMemory?.stm) {
                setSessions((prev: Session[]) => prev.map(session => {
                    if (session.id !== currentSessionId || session.memoryMode !== currentSession.memoryMode
                        || !session.messages.some(message => message.storyGenerationId === generationId)) return session;
                    const count = Math.max(0, session.turnCount || 0);
                    const existing = parseLocalMemoryEntries(session.stm);
                    const nextRecord = "• " + inlineStoryMemory.stm;
                    if (count >= 6 && inlineStoryMemory.ltm) {
                        return { ...session, stm: "", ltm: inlineStoryMemory.ltm, stmBackup: session.stm, turnCount: 0, updatedAt: Date.now() };
                    }
                    // A missing consolidation never destroys earlier STM.
                    return { ...session, stm: formatLocalMemoryEntries([...existing, nextRecord]),
                        stmBackup: session.stm, turnCount: count + 1, updatedAt: Date.now() };
                }));
            }
            // Missing memory is explicitly recoverable from the message UI,
            // never by an automatic background summarize request.

        } catch (e: any) {
            if (e.name !== 'AbortError') {
                showToast(e.message);
                if (currentSession.memoryMode === "infinite" && /(?:联网搜索|搜索供应商|web_search|web search|grounding)/i.test(String(e.message))) {
                    dialog.notify("联网搜索工具调用失败：" + String(e.message), { type: "error", duration: 5000 });
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    // A draw request is executed ONLY after a user click and explicit confirmation.
    const generateDraw = async (messageIndex: number): Promise<void> => {
        if (!config.imageGen) throw new Error('请先在设置中启用生图功能');
        if (isLoading || !currentSession) throw new Error('请等待当前回复完成');
        const message = currentSession.messages[messageIndex];
        if (!message || message.role !== 'assistant' || typeof message.content !== 'string') throw new Error('找不到待生成的插图');
        const match = message.content.match(/<draw>[\s\S]*?<\/draw>/);
        if (!match) throw new Error('该插图已经生成或已被移除');
        const payload = buildDrawRequest(message.content, {
            activeCharacterId: message.characterId || activeCharacterId,
            manualOutfitId,
            characters: [...CHARACTERS, ...customCharacters.map((c: any) => ({ id: c.id, name: c.names?.[locale] || c.name || c.id }))],
            charStatus: currentSession.charStatus,
            settings: config.imageSettings,
        });
        if (!payload) throw new Error('插图提示词无效');
        setIsGlobalGenerating(true);
        try {
            const response = await fetch('/api/draw', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({...payload, byok:cloudCredentials[payload.provider || ""]}),
            });
            const result = await response.json();
            if (!response.ok || !result.success || !result.image) throw new Error(result.error || `生图服务返回 HTTP ${response.status}`);
            const url = await uploadImageToCloud(result.image, result.meta);
            if (!url) throw new Error('图片已生成，但保存到本地画廊失败');
            const originalTag = match[0];
            const completedTag = originalTag.replace('<draw>', '<draw_log>').replace('</draw>', '</draw_log>');
            setSessions((prev: any) => prev.map((s: any) => s.id !== currentSessionId ? s : ({
                ...s,
                messages: s.messages.map((m: any, index: number) => index !== messageIndex ||
                  typeof m.content !== 'string' || !m.content.includes(originalTag) ? m : ({
                    ...m, content: m.content.replace(originalTag, `${completedTag}\n\n![Generated](${url})`),
                  })),
            })));
            showToast('🎨 插图已保存');
        } finally {
            setIsGlobalGenerating(false);
        }
    };

    // Regeneration and user edits must both restore the *whole* prior story state
    // BEFORE a new request is dispatched. Keep the restored state in the same
    // session update as the shortened/edited message history.
    const rewindStoryTurn = (messages: Session["messages"], snapshot?: Session["messages"][number]["storyStateBefore"]) => {
        setSessions((prev: Session[]) => prev.map(session => session.id === currentSessionId
            ? { ...restoreStoryState(session, snapshot), messages, updatedAt: Date.now() }
            : session));
        setPendingStoryRegeneration({ sessionId: currentSessionId, messagesLength: messages.length });
    };

    const rewindNovelTurn = (messages: Session["messages"], snapshot?: Session["messages"][number]["novelStateBefore"]) => {
        setSessions((prev: Session[]) => prev.map(session => session.id === currentSessionId
            ? { ...restoreNovelState(session, snapshot), messages, updatedAt: Date.now() }
            : session));
        setPendingStoryRegeneration({ sessionId: currentSessionId, messagesLength: messages.length });
    };

    // This effect runs only after the previous story state AND message history have committed.
    useEffect(() => {
        if (!pendingStoryRegeneration || isLoading || !currentSession ||
            pendingStoryRegeneration.sessionId !== currentSessionId ||
            currentSession.messages.length !== pendingStoryRegeneration.messagesLength) return;
        setPendingStoryRegeneration(null);
        if (currentSession.messages[currentSession.messages.length - 1]?.role !== "user") {
            showToast("没有找到可以重新生成的用户输入。"); return;
        }
        void handleSend(undefined, [...currentSession.messages]);
    }, [pendingStoryRegeneration, currentSession, currentSessionId, isLoading]);

    const handleRegenerate = async (idx: number) => {
        if (!currentSession || isLoading) return;
        const target = currentSession.messages[idx];
        if (!target || target.role !== "assistant") return;
        if ((currentSession.memoryMode === "sliding" || currentSession.memoryMode === "novel") && idx !== currentSession.messages.length - 1) {
            showToast("请从最后一轮开始刷新，以便正确回退状态与记忆。"); return;
        }
        if (!await dialog.confirm(currentSession.memoryMode === "sliding"
            ? "确认刷新这轮故事吗？将恢复本轮之前的自身状态、角色数值、剧情引导与记忆，然后重新生成。"
            : currentSession.memoryMode === "novel"
              ? "确认重写最后一章吗？将回退本章的环境、事件、登场角色与记忆，保留世界线和 Style。"
              : "确认重新生成这条 AI 回复吗？当前回复会被替换。")) return;
        if (currentSession.memoryMode !== "sliding" && currentSession.memoryMode !== "novel") {
            void handleSend(undefined, currentSession.messages.slice(0, idx));
            return;
        }
        const keptMessages = currentSession.messages.slice(0, idx);
        if (keptMessages[keptMessages.length - 1]?.role !== "user") {
            showToast("没有找到可用于重新生成的最后一条用户消息。");
            return;
        }
        const snapshot = target.storyStateBefore || currentSession.messages[idx - 1]?.storyStateBefore;
        if (currentSession.memoryMode === "novel") {
            rewindNovelTurn(keptMessages, target.novelStateBefore || currentSession.messages[idx - 1]?.novelStateBefore);
        } else {
            rewindStoryTurn(keptMessages, snapshot);
        }
    };

    const handleEditMessage = (idx: number, revisedText: string) => {
        if (!currentSession || isLoading) return;
        const target = currentSession.messages[idx];
        if (!target || target.role !== "user" || !revisedText.trim()) {
            showToast("请输入要重新生成的用户消息。");
            return;
        }
        if (currentSession.memoryMode !== "sliding") {
            void handleSend(undefined, [...currentSession.messages.slice(0, idx), { ...target, content: revisedText }]);
            return;
        }
        const trailing = currentSession.messages.slice(idx + 1);
        if (trailing.length > 1 || (trailing.length === 1 && trailing[0].role !== "assistant")) {
            showToast("故事模式只能修改最后一轮的用户消息，以保证故事状态正确回退。");
            return;
        }
        const snapshot = target.storyStateBefore || trailing[0]?.storyStateBefore;
        const keptMessages = [...currentSession.messages.slice(0, idx), { ...target, content: revisedText }];
        rewindStoryTurn(keptMessages, snapshot);
    };

    const handleDeleteMessage = async (idx: number, role: string) => {
        if (!currentSession || isLoading) return;
        const oldMessages = currentSession.messages as any[];
        const latestAssistant = role === "assistant" ? oldMessages[idx] : oldMessages[idx + 1]?.role === "assistant" ? oldMessages[idx + 1] : null;
        const lastTurn = idx === oldMessages.length - 1 || (role === "user" && idx === oldMessages.length - 2);
        if ((currentSession.memoryMode === "sliding" || currentSession.memoryMode === "novel") && !lastTurn) {
            showToast("故事／小说模式仅支持从最后一轮向前删除，以确保状态与记忆同步回退。");
            return;
        }
        if (!await dialog.confirm(currentSession.memoryMode === "novel"
            ? "确定删除最新章节并回退环境、事件、登场角色和记忆吗？世界线与 Style 会保留。"
            : "确定删除最后一条消息并回退故事状态与记忆吗？")) return;
        const newMsgs = [...oldMessages];
        if (role === "assistant") newMsgs.splice(idx, 1);
        else if (role === "user") newMsgs.splice(idx, newMsgs[idx + 1]?.role === "assistant" ? 2 : 1);
        setSessions((prev: any) => prev.map((s: any) => {
            if (s.id !== currentSessionId) return s;
            if (s.memoryMode === "novel") {
                const checkpoint = latestAssistant?.novelStateBefore || (role === "user" ? oldMessages[idx]?.novelStateBefore : undefined);
                // Old archives may lack checkpoints: clear the stale AI state rather than
                // snapshotting the state of a chapter that is being deleted.
                return { ...restoreNovelState(s, checkpoint), messages: newMsgs, updatedAt: Date.now() };
            }
            if (s.memoryMode !== "sliding") return { ...s, messages: newMsgs, updatedAt: Date.now() };
            // Prefer the saved pre-turn snapshot even when deleting the FIRST turn:
            // this restores the user's original first-turn pins, not a later AI cast.
            const checkpoint = latestAssistant?.storyStateBefore || (role === "user" ? oldMessages[idx]?.storyStateBefore : undefined);
            const restored = checkpoint || newMsgs.some((m: any) => m.role === "user")
                ? restoreStoryState(s, checkpoint)
                : emptyStoryState(s);
            return { ...restored, messages: newMsgs, updatedAt: Date.now() };
        }));
    };

    const handleRepoUpdate = (newRepo: any) => {
        setSessions((prev: any) => prev.map((s: any) => s.id === currentSessionId ? { ...s, codeRepository: newRepo } : s));
    };

    const completeStoryState = async (index: number) => {
        if (!currentSession || currentSession.memoryMode !== "sliding" || isLoading) return;
        if (index !== currentSession.messages.length - 1) {
            showToast("只能补齐最新一轮的状态，避免覆盖后续剧情。"); return;
        }
        const target = currentSession.messages[index];
        if (!target || target.role !== "assistant" || !target.storyProtocolMissing) return;
        if (!await dialog.confirm("确认调用当前模型补齐本轮故事状态吗？仅恢复 game_state，不续写正文。补齐期间将暂时锁定输入框。")) return;
        if (isLoading) return;
        const modelToUse = (config.customModelId || config.selectedModel || "").trim();
        if (!modelToUse) { showToast("请先选择模型。"); return; }
        const previous = target.storyStateBefore?.fields;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setStoryStateRepairing(true);
        setIsLoading(true);
        try {
            const prompt = [
                "仅补齐这一轮已经完成的故事正文的 game_state，禁止续写或修改剧情。",
                "此前自身状态: " + JSON.stringify(previous?.protagonist ?? currentSession.protagonist ?? null).slice(0, 2400),
                "此前其他角色状态: " + JSON.stringify(previous?.charStatus ?? currentSession.charStatus ?? []).slice(0, 4000),
                "世界线: " + JSON.stringify(currentSession.storyWorldline),
                "上一轮 STM: " + String(currentSession.stm || "").slice(-4800),
                "上一轮 LTM: " + String(currentSession.ltm || "").slice(-6500),
                "已完成正文:\n" + String(target.content).slice(-14000),
            ].join("\n\n");
            const response = await fetch("/api/chat", {
                method: "POST", headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    stateRepair: true, repairMemory: target.memoryRepairMissing === true,
                    memoryTurnCount: parseLocalMemoryEntries(currentSession.stm).length,
                    memoryMode: "sliding", model: modelToUse,
                    provider: apiProvider, byok: cloudCredentials[apiProvider], uiLanguage: locale,
                    debugRequestPayload: config.terminalRequestLog === true,
                    debugFullOutput: config.terminalLog === true,
                    storyRole: currentSession.storyRole || "observer",
                    storyPovId: currentSession.storyPovId,
                    storySelf: currentSession.storySelfSnapshot
                        ? asChartaSelfPromptData(currentSession.storySelfSnapshot) : null,
                    storyWorldline: currentSession.storyWorldline,
                    storyNextCastIds: currentSession.storyNextCastIds || [],
                    storyCastWorlds: storyWorlds.map((world: any) => ({
                        id: world.id, name: world.name, description: world.description, canonTimeline: world.canonTimeline,
                    })),
                    customCharacters: customCharacters.map(asChartaPromptData),
                    danmakuEnabled: config.danmakuEnabled === true, danmakuCount: config.danmakuCount || 8,
                    messages: [{ role: "user", content: prompt }],
                }),
            });
            if (!response.ok || !response.body) throw new Error("补齐请求失败");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let raw = "";
            while (raw.length < 25000) {
                const { value, done } = await reader.read();
                if (done) break;
                raw += decoder.decode(value, { stream: true });
            }
            raw += decoder.decode();
            const recoveredMemory = target.memoryRepairMissing ? parseStoryTurnMemory(raw) : null;
            if (target.memoryRepairMissing && (!recoveredMemory?.stm ||
                (parseLocalMemoryEntries(currentSession.stm).length >= 6 && !recoveredMemory.ltm))) {
                throw new Error("模型未补齐本轮 STM/LTM");
            }
            const block = lastStoryGameState(raw);
            if (!block) throw new Error("模型未返回 game_state");
            const state = normalizeStoryProtocol(JSON.parse(block.json));
            if (!isUsableStoryProtocol(state)) {
                throw new Error("补齐状态不完整：" + storyProtocolIssues(state).join("、"));
            }
            const repaired: any = state;
            const worldline = parseStoryWorldline(currentSession.storyWorldline);
            const allowedChars: any[] = [...CHARACTERS, ...customCharacters].filter((char: any) =>
                worldline && storyCastAllowed(char, worldline));
            const allowed = new Set(allowedChars.map((char: any) => char.id));
            const stage = selectStoryCastIds(repaired.sceneCastIds, allowed);
            const savedSelf = currentSession.storyRole === "participant"
                ? currentSession.storySelfSnapshot || customSelves.find((s: any) => s.id === currentSession.storySelfId)
                : null;
            const pov = allowedChars.find((char: any) => char.id === currentSession.storyPovId);
            const protagonist = currentSession.storyRole === "observer" && !pov ? undefined
                : completeStoryProtagonist({
                    raw: repaired.protagonist, previous: currentSession.protagonist,
                    name: savedSelf ? selfName(savedSelf, locale) : pov?.name || "",
                    era: currentSession.storyWorldline?.era,
                    period: currentSession.storyWorldline?.period,
                });
            const oldStats = Array.isArray(currentSession.charStatus) ? currentSession.charStatus : [];
            const excluded = new Set([savedSelf?.id, ...Object.values(savedSelf?.names || {}), pov?.id, pov?.name]
                .filter(Boolean).map(v => String(v).toLocaleLowerCase()));
            const character = currentSession.storyRole === "observer" && !pov ? undefined
                : (Array.isArray(repaired.character) ? repaired.character : [])
                    .filter((entry: any) => entry && typeof entry === "object"
                        && !excluded.has(String(entry.id || "").toLocaleLowerCase())
                        && !excluded.has(String(entry.name || "").toLocaleLowerCase())
                        && allowedChars.some((char: any) => char.id === entry.id || char.name === entry.name))
                    .map((entry: any) => {
                        const prior: any = oldStats.find((item: any) => item.id === entry.id || item.name === entry.name) || {};
                        const metrics = ["affection", "Possessiveness", "Obsession", "Lust"] as const;
                        const previousScores = Object.fromEntries(metrics.map(k => [k, Number(k === "Lust" ? (prior.Lust ?? prior.Intimacy) : prior[k]) || 0])) as {
                            affection: number; Possessiveness: number; Obsession: number; Lust: number;
                        };
                        const proposed = Object.fromEntries(metrics.map(k => [k,
                            typeof entry[k] === "number" && Number.isFinite(entry[k]) ? entry[k] : previousScores[k]])) as typeof previousScores;
                        const updated = { ...prior, ...entry, ...calculateNewStats(previousScores, proposed) };
                        for (const key of ["age", "gender", "environment", "timeDesc", "live2d", "effect"]) delete updated[key];
                        return updated;
                    });
            setSessions((prev: Session[]) => prev.map(session => {
                const currentTarget = session.messages[index];
                if (session.id !== currentSessionId || index !== session.messages.length - 1
                    || !currentTarget?.storyProtocolMissing || currentTarget.storyGenerationId !== target.storyGenerationId
                    || currentTarget.content !== target.content) return session;
                // The inline memory arrived in the same original stream. Preserve it
                // until state recovery succeeds; never pay for a second summary
                // when this metadata is already complete.
                const pending = recoveredMemory || currentTarget.storyPendingMemory;
                const count = Math.max(0, session.turnCount || 0);
                const nextMemory = pending?.stm
                    ? count >= 6 && pending.ltm
                        ? { stm: "", ltm: pending.ltm, stmBackup: session.stm, turnCount: 0 }
                        : { stm: formatLocalMemoryEntries([
                            ...parseLocalMemoryEntries(session.stm), "• " + pending.stm,
                          ]), stmBackup: session.stm, turnCount: count + 1 }
                    : {};
                return {
                    ...session, ...nextMemory,
                    protagonist, charStatus: character, sceneCastIds: stage,
                    plotSuggestions: repaired.suggestions,
                    timeline: session.storyWorldline
                        ? { ...repaired.timeline,
                            era: advanceWorldlineFromState(session.storyWorldline, repaired.timeline).era,
                            period: advanceWorldlineFromState(session.storyWorldline, repaired.timeline).period }
                        : repaired.timeline,
                    lastDanmaku: config.danmakuEnabled && Array.isArray(repaired.danmaku)
                        ? repaired.danmaku.filter((v: unknown) => typeof v === "string").slice(0, Math.min(24, config.danmakuCount || 8)) : [],
                    ...(session.storyWorldline
                        ? { storyWorldline: advanceWorldlineFromState(session.storyWorldline, repaired.timeline) } : {}),
                    messages: session.messages.map((message, i) => i === index ? { ...message, storyProtocolMissing: false, storyPendingMemory: undefined, metadataRepairMissing: false, memoryRepairMissing: false } : message),
                    updatedAt: Date.now(),
                };
            }));
            dialog.notify("故事状态已补齐，正文保持不变。", { type: "success", tone: "story" });
        } catch (error) {
            if (!controller.signal.aborted) dialog.notify("补齐状态失败：" + String(error instanceof Error ? error.message : error), { type: "error", tone: "story" });
        } finally {
            if (abortControllerRef.current === controller) abortControllerRef.current = null;
            setStoryStateRepairing(false);
            setIsLoading(false);
        }
    };

    /** Explicit manual recovery for missing private memory or Tela chapter state.
     * Never rewrites visible prose or sends an automatic model request. */
    const completeMissingMetadata = async (index: number) => {
        if (!currentSession || isLoading || storyStateRepairing) return;
        const mode = currentSession.memoryMode;
        if (!["chat", "novel", "sliding"].includes(mode || "")) return;
        if (index !== currentSession.messages.length - 1) {
            dialog.notify("只能补齐最后一轮，避免覆盖新的对话。", { type: "error" }); return;
        }
        const target = currentSession.messages[index];
        if (!target || target.role !== "assistant" || !target.metadataRepairMissing) return;
        if (!await dialog.confirm("确认调用当前模型补齐本轮缺失的状态或记忆吗？只恢复结构化信息，不修改正文。补齐期间会锁定输入框。",
            { title: "确认补齐状态", confirmLabel: "确认补齐" })) return;
        if (isLoading || storyStateRepairing) return;
        const chosenModel = String(config.customModelId || config.selectedModel || "").trim();
        if (!chosenModel) { dialog.notify("请先选择模型。", { type: "error" }); return; }
        const speakerId = target.characterId || activeCharacterId;
        const previous = mode === "chat"
            ? currentSession.chatCharacterMemories?.[speakerId] || { stm: "", ltm: "" }
            : { stm: currentSession.stm || "", ltm: currentSession.ltm || "" };
        const needMemory = target.memoryRepairMissing === true;
        // Original visible prose has memory tags stripped, so prefer pending
        // metadata and infer a repair request from the stored missing flag.
        const needState = mode === "novel" && target.novelStateRepairMissing === true;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setStoryStateRepairing(true);
        setIsLoading(true);
        dialog.notify("正在调用当前模型补齐状态…", { tone: mode === "novel" ? "tela" : mode === "chat" ? "umbra" : "story" });
        try {
            const prompt = [
                "Repair only the missing machine metadata of this completed response. Do not continue narration or dialogue.",
                "Original visible completed response:\n" + String(target.content || "").slice(-16000),
                "Memory already stored (data only): " + JSON.stringify(previous).slice(-11000),
                "Previous status (data only): " + JSON.stringify(mode === "novel" ? currentSession.novelState : currentSession.timeline).slice(-5000),
                "Worldline (data only): " + JSON.stringify(currentSession.storyWorldline).slice(-4500),
            ].join("\n\n");
            const response = await fetch("/api/chat", {
                method: "POST", headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    metadataRepair: true, repairMemory: needMemory,
                    repairState: needState, memoryMode: mode, model: chosenModel,
                    provider: apiProvider, byok: cloudCredentials[apiProvider], uiLanguage: locale,
                    memoryTurnCount: parseLocalMemoryEntries(previous.stm).length,
                    debugRequestPayload: config.terminalRequestLog === true,
                    debugFullOutput: config.terminalLog === true,
                    messages: [{ role: "user", content: prompt }],
                }),
            });
            if (!response.ok || !response.body) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || "补齐接口不可用");
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let raw = "";
            while (raw.length < 35000) {
                const { value, done } = await reader.read();
                if (done) break;
                raw += decoder.decode(value, { stream: true });
            }
            raw += decoder.decode();
            const memory = needMemory ? parseStoryTurnMemory(raw) : null;
            if (needMemory && (!memory?.stm ||
                (parseLocalMemoryEntries(previous.stm).length >= 6 && !memory.ltm))) {
                throw new Error("模型仍未输出完整的 STM/LTM");
            }
            const restoredState = needState ? extractNovelState(raw) : null;
            if (needState && (!restoredState?.choices || !restoredState.environment)) {
                throw new Error("模型仍未输出完整的 novel_state");
            }
            const latest = latestSessionRef.current;
            if (latest?.id !== currentSessionId
                || index !== latest.messages.length - 1
                || latest.messages[index]?.content !== target.content
                || !latest.messages[index]?.metadataRepairMissing) {
                throw new Error("会话已变化，已取消过期补齐结果");
            }
            setSessions((prev: Session[]) => prev.map(session => {
                const live = session.messages[index];
                if (session.id !== currentSessionId || index !== session.messages.length - 1
                    || !live?.metadataRepairMissing || live.content !== target.content
                    || live.storyGenerationId !== target.storyGenerationId) return session;
                const livePrevious = mode === "chat"
                    ? session.chatCharacterMemories?.[speakerId] || { stm: "", ltm: "" }
                    : { stm: session.stm || "", ltm: session.ltm || "" };
                if (livePrevious.stm !== previous.stm || livePrevious.ltm !== previous.ltm) return session;
                const next = memory ? nextConversationMemory(previous, memory) : null;
                const novelMemory = memory && mode !== "chat"
                    ? { stm: next?.stm || "", ltm: next?.ltm || previous.ltm,
                        turnCount: next?.turnCount ?? session.turnCount ?? 0 } : {};
                return {
                    ...session,
                    ...(mode === "chat" && next ? { chatCharacterMemories: {
                        ...(session.chatCharacterMemories || {}), [speakerId]: { stm: next.stm, ltm: next.ltm },
                    } } : novelMemory),
                    ...(restoredState ? {
                        novelState: session.storyWorldline ? {
                            ...restoredState,
                            era: advanceWorldlineFromState(session.storyWorldline, restoredState).era,
                            period: advanceWorldlineFromState(session.storyWorldline, restoredState).period,
                        } : restoredState,
                        novelDraft: session.novelDraft
                            ? { ...session.novelDraft, environment: restoredState.environment,
                                event: restoredState.event }
                            : { selectedCharIds: session.storyNextCastIds || [],
                                style: "", outline: "", themeMode: "paper" as const,
                                environment: restoredState.environment, event: restoredState.event },
                        lastDanmaku: Array.isArray(restoredState.danmaku) ? restoredState.danmaku : [],

                        ...(session.storyWorldline ? {
                            storyWorldline: advanceWorldlineFromState(session.storyWorldline, restoredState),
                        } : {}),
                    } : {}),
                    messages: session.messages.map((message, i) => i === index
                        ? { ...message, metadataRepairMissing: false, memoryRepairMissing: false, novelStateRepairMissing: false,
                            ...(restoredState?.choices ? { novelChoices: restoredState.choices } : {}) }
                        : message),
                    updatedAt: Date.now(),
                };
            }));
            dialog.notify("状态补齐成功，原正文已保留。",
                { type: "success", tone: mode === "novel" ? "tela" : mode === "chat" ? "umbra" : "story" });
        } catch (error) {
            if (!controller.signal.aborted) dialog.notify("补齐状态失败：" + (error instanceof Error ? error.message : String(error)),
                { type: "error", tone: mode === "novel" ? "tela" : mode === "chat" ? "umbra" : "story" });
        } finally {
            if (abortControllerRef.current === controller) abortControllerRef.current = null;
            setStoryStateRepairing(false);
            setIsLoading(false);
        }
    };

    const completeEngineeringOutput = async (index: number) => {
        if (!currentSession || currentSession.memoryMode !== "infinite" || isLoading) return;
        if (!currentSession.messages[index]?.engineeringOutputIncomplete) return;
        if (!await dialog.confirm("确认要求当前角色工程师补全缺失的代码文件吗？这会额外调用一次所选模型。")) return;
        void handleSend(OFFICINA_COMPLETION_REQUEST);
    };

    return {
        input, setInput,
        isLoading, storyStateRepairing,
        selectedFile, setSelectedFile,
        handleSend, completeEngineeringOutput, completeStoryState, completeMissingMetadata,
        stopGeneration,
        handleRegenerate,
        handleEditMessage,
        handleDeleteMessage,
        handleRepoUpdate,
        generateDraw
    };
};