"use client";

import { useEffect, useRef, useState } from "react";
import type { ViaeConversation, ViaeMessage, Session } from "../types";
import { formatLocalMemoryEntries, LOCAL_STM_SLOTS, parseLocalMemoryEntries } from "../lib/localMemory";
import { useLanguage } from "../context/LanguageContext";
import { DEFAULT_CONTEXT_WINDOW_TOKENS } from "../lib/contextWindow";
import { useAppDialog } from "../context/DialogContext";
import { asChartaPromptData, type ChartaCharacter } from "../lib/charta";
import { asChartaSelfPromptData, type ChartaSelf } from "../lib/chartaSelf";
import { viaeWorldline } from "../lib/viaeWorldline";
import { applyWorldlineAdvance, stripWorldlineAdvance } from "../lib/worldlineAdvanceProtocol";
import { parseStoryTurnMemory, stripStoryTurnMemory } from "../lib/storyTurnMemory";
import { nextConversationMemory } from "../lib/conversationTurnMemory";

const newId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Viae messages live *inside* the Viae workspace; they never enter normal chat history. */
export function useViaeEngine({ session, updateSession, provider, model, notify, customCharacters = [], activeSelf = null, terminalRequestLogEnabled = false, terminalLogEnabled = false, contextWindowTokens = DEFAULT_CONTEXT_WINDOW_TOKENS }: {
  session: Session;
  updateSession: (updater: (current: Session) => Session) => void;
  provider: string;
  model: string;
  notify?: (message: string) => void;
  customCharacters?: ChartaCharacter[];
  activeSelf?: ChartaSelf | null;
  terminalRequestLogEnabled?: boolean;
  terminalLogEnabled?: boolean;
  contextWindowTokens?: number;
}) {
  const { locale } = useLanguage();
  const dialog = useAppDialog();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => abortRef.current?.abort(), []);
  const activeGroup = (session.limeGroups || []).find(g => g.id === session.limeGroupId);
  const activeGroupRef = useRef<ViaeConversation | undefined>(undefined);
  activeGroupRef.current = activeGroup;

  const patchGroup = (id: string, mapper: (group: ViaeConversation) => ViaeConversation) => {
    updateSession(current => ({
      ...current,
      updatedAt: Date.now(),
      limeGroups: (current.limeGroups || []).map(group => group.id === id ? mapper(group) : group),
    }));
  };

  const stop = () => abortRef.current?.abort();

  const send = async (regenerate = false) => {
    if (busyRef.current || !activeGroup || !provider) return;
    if (!model.trim()) {
      dialog.notify("请先为当前供应商选择模型，确认后再发送。");
      return;
    }
    if (activeGroup.pov === "insider" && !activeSelf) { notify?.("参与模式需要当前 Charta 启用的自设。"); return; }
    if (activeGroup.type === "direct" && activeGroup.members.length !== (activeGroup.pov === "outsider" ? 2 : 1)) {
      notify?.(activeGroup.pov === "outsider" ? "旁观小径需要两位角色" : "参与小径需要一位角色");
      return;
    }
    if (activeGroup.type === "group" && activeGroup.members.length < 2) { notify?.("路口至少需要两位角色"); return; }
    const phoneOwnerId = activeGroup.members.includes(activeGroup.defaultPovChar || "")
      ? activeGroup.defaultPovChar! : activeGroup.members[0];
    const permittedReplies = activeGroup.pov === "outsider" || activeGroup.type === "direct"
      ? activeGroup.members : activeGroup.members.filter(id => id !== phoneOwnerId);
    const text = input.trim();
    const previous = activeGroup.messages || [];
    const isReplace = regenerate && previous[previous.length - 1]?.role === "assistant";
    const preceding = isReplace ? previous.slice(0, -1) : previous;
    if (!regenerate && !text) return;
    if (regenerate && !preceding.some(msg => msg.role === "user")) return;

    const lastAssistant = isReplace ? previous[previous.length - 1] : null;
    const checkpoint = lastAssistant?.viaeTurnBefore;
    // A legacy archive cannot rewind the exact prior memory or worldline.
    // Permit refreshing its visible reply, but preserve these archives as-is.
    const legacyRefresh = regenerate && isReplace && !checkpoint;
    const requestGroup: ViaeConversation = checkpoint
      ? { ...activeGroup, stm: checkpoint.stm, ltm: checkpoint.ltm,
          turnCount: checkpoint.turnCount, storyWorldline: checkpoint.storyWorldline,
          timeline: checkpoint.timeline }
      : activeGroup;
    const turnBefore: NonNullable<ViaeMessage["viaeTurnBefore"]> = {
      stm: requestGroup.stm || "", ltm: requestGroup.ltm || "",
      turnCount: parseLocalMemoryEntries(requestGroup.stm).length,
      storyWorldline: requestGroup.storyWorldline, timeline: requestGroup.timeline,
    };
    const requestId = newId();
    const userMessage: ViaeMessage | null = regenerate ? null : { id: newId(), role: "user", kind: activeGroup.pov === "outsider" ? "director" : "chat", content: text, createdAt: Date.now() };
    const context = userMessage ? [...preceding, userMessage] : preceding;
    const assistant: ViaeMessage = { id: requestId, role: "assistant", content: "", createdAt: Date.now(), modelName: model, viaeTurnBefore: turnBefore };
    const groupId = activeGroup.id;
    const controller = new AbortController();
    abortRef.current = controller;
    busyRef.current = true;
    setIsLoading(true);
    if (!regenerate) setInput("");
    patchGroup(groupId, group => ({ ...group,
      ...(checkpoint ? { stm: checkpoint.stm, ltm: checkpoint.ltm,
        turnCount: checkpoint.turnCount, storyWorldline: checkpoint.storyWorldline,
        timeline: checkpoint.timeline } : {}),
      messages: [...context, assistant], updatedAt: Date.now() }));

    let fullText = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          // Legacy wire mode remains "lime" for compatibility with saved sessions.
          memoryMode: "lime", provider, model, uiLanguage: locale,
          contextWindowTokens,
          debugRequestPayload: terminalRequestLogEnabled,
          debugFullOutput: terminalLogEnabled,
          customCharacters: customCharacters.map(asChartaPromptData),
          viaeSelf: activeGroup.pov === "insider" && activeSelf ? asChartaSelfPromptData(activeSelf) : null,
          messages: context.map(msg => ({ role: msg.role, content: msg.content, kind: msg.kind })),
          stm: requestGroup.stm || "", ltm: requestGroup.ltm || "",
          viaeGroup: {
            name: requestGroup.name,
            type: requestGroup.type,
            members: requestGroup.members,
            pov: requestGroup.pov,
            defaultPovChar: requestGroup.defaultPovChar,
            reality: requestGroup.reality,
            auContext: requestGroup.auContext,
            timeline: requestGroup.timeline,
            storyWorldline: requestGroup.storyWorldline,
          },
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `Viae API HTTP ${response.status}`);
      }
      if (!response.body) throw new Error("Viae API response has no stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const currentText = stripStoryTurnMemory(stripWorldlineAdvance(fullText));
        patchGroup(groupId, group => ({
          ...group,
          messages: group.messages.map(message => message.id === requestId ? { ...message, content: currentText } : message),
        }));
      }
      fullText += decoder.decode();
      const rawOutput = fullText;
      const inlineMemory = parseStoryTurnMemory(rawOutput);
      fullText = stripStoryTurnMemory(stripWorldlineAdvance(rawOutput));
      if (!fullText.trim()) throw new Error("模型没有返回聊天内容");

      const originalStm = String(requestGroup.stm || "");
      const originalLtm = String(requestGroup.ltm || "");
      const inlineApplied = !legacyRefresh && inlineMemory?.stm
        ? nextConversationMemory({ stm: originalStm, ltm: originalLtm }, inlineMemory) : null;
      patchGroup(groupId, group => {
        const currentWorldline = viaeWorldline(group);
        const advanced = legacyRefresh ? null : applyWorldlineAdvance(currentWorldline, rawOutput);
        const nextWorldline = advanced && (advanced.era !== currentWorldline.era || advanced.period !== currentWorldline.period)
          ? advanced : currentWorldline;
        const unchanged = (group.stm || "") === originalStm && (group.ltm || "") === originalLtm;
        return {
          ...group,
          storyWorldline: nextWorldline,
          timeline: nextWorldline.kind === "canon" ? nextWorldline.period.replace(/^T-/, "") : "AU",
          ...(inlineApplied && unchanged ? { stm: inlineApplied.stm, ltm: inlineApplied.ltm,
            turnCount: inlineApplied.turnCount } : {}),
          messages: group.messages.map(message => message.id === requestId ? { ...message, content: fullText } : message),
        };
      });

      // No automatic summarize: any missing memory or invalid chat envelope
      // remains recoverable via the explicit manual repair button.
      const chatBlock = fullText.match(/<viae_chat\s*>([\s\S]*?)<\/viae_chat\s*>/i);
      let completeChat = false;
      if (chatBlock) {
        try {
          const parsed: unknown = JSON.parse(chatBlock[1]);
          completeChat = Array.isArray(parsed) && parsed.length > 0 && parsed.every(item =>
            item && typeof item === "object" && typeof item.text === "string"
            && item.text.trim() && typeof item.charId === "string"
            && permittedReplies.includes(item.charId));
          if (completeChat && Array.isArray(parsed) && activeGroup.pov === "outsider") {
            completeChat = new Set(parsed.map((item: { charId: string }) => item.charId)).size >= 2;
          }
        } catch { completeChat = false; }
      }
      const memoryMissing = !legacyRefresh && (!inlineMemory?.stm ||
        (parseLocalMemoryEntries(originalStm).length >= LOCAL_STM_SLOTS && !inlineMemory.ltm));
      const needsRepair = memoryMissing || !completeChat;
      if (needsRepair) {
        patchGroup(groupId, group => ({ ...group, messages: group.messages.map(m =>
          m.id === requestId ? { ...m, metadataRepairMissing: true,
            memoryRepairMissing: memoryMissing } : m) }));
        notify?.("本轮 VIAE 状态不完整，可点击「补齐状态」。");
      }
      if (legacyRefresh) {
        dialog.notify("旧存档回复已刷新；原有 STM/LTM 与时间线未自动修改，请按需检查记忆档案。",
          { tone: "viae", type: "warning" });
      }
    } catch (error) {
      if (isReplace && lastAssistant) {
        // A failed/aborted refresh must not destroy the old reply, its
        // memory, or a chronology update that belonged to the old reply.
        patchGroup(groupId, group => group.messages[group.messages.length - 1]?.id !== requestId
          ? group : {
              ...group,
              stm: activeGroup.stm, ltm: activeGroup.ltm, turnCount: activeGroup.turnCount,
              storyWorldline: activeGroup.storyWorldline, timeline: activeGroup.timeline,
              messages: [...group.messages.slice(0, -1), lastAssistant],
            });
      } else if (!fullText.trim()) {
        patchGroup(groupId, group => ({
          ...group, messages: group.messages.filter(msg => msg.id !== requestId),
        }));
      }
      if (controller.signal.aborted) notify?.("已停止生成；刷新时原回复已保留");
      else notify?.(error instanceof Error ? error.message : "Viae 请求失败");
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  /** Manual, user-confirmed metadata recovery; no automatic summaries. */
  const repairMessage = async (index: number) => {
    if (!activeGroup || busyRef.current || isLoading) return;
    if (index !== activeGroup.messages.length - 1) {
      dialog.notify("只能补齐当前道路的最后一轮状态。", { type: "error", tone: "viae" });
      return;
    }
    const target = activeGroup.messages[index];
    if (!target || target.role !== "assistant" || !target.metadataRepairMissing) return;
    if (!await dialog.confirm("确认调用当前模型补齐 VIAE 消息协议或记忆吗？请求期间会锁定输入框，原消息不会被自动摘要覆盖。",
      { title: "VIAE · 补齐状态", tone: "viae", confirmLabel: "确认补齐" })) return;
    if (busyRef.current) return;
    const phoneOwnerId = activeGroup.members.includes(activeGroup.defaultPovChar || "")
      ? activeGroup.defaultPovChar! : activeGroup.members[0];
    const permittedReplies = activeGroup.pov === "outsider" || activeGroup.type === "direct"
      ? activeGroup.members : activeGroup.members.filter(id => id !== phoneOwnerId);
    const rawChat = String(target.content || "");
    const match = rawChat.match(/<(?:viae_chat|lime_chat)>\s*([\s\S]*?)<\/(?:viae_chat|lime_chat)>/i);
    let needsChat = !match;
    if (match) {
      try {
        const parsed: unknown = JSON.parse(match[1]);
        needsChat = !Array.isArray(parsed) || !parsed.length ||
          !parsed.every(item => item && typeof item === "object" &&
            typeof item.text === "string" && typeof item.charId === "string" &&
            permittedReplies.includes(item.charId));
      } catch { needsChat = true; }
    }
    const previous = { stm: activeGroup.stm || "", ltm: activeGroup.ltm || "" };
    const repairMemory = target.memoryRepairMissing === true;
    const controller = new AbortController();
    abortRef.current = controller;
    busyRef.current = true;
    setIsLoading(true);
    dialog.notify("正在补齐 VIAE 状态…", { tone: "viae" });
    try {
      const prompt = [
        "Restore ONLY missing machine metadata from the completed VIAE dialogue. Never continue the conversation.",
        "Original message: " + rawChat.slice(-17000),
        "Permitted generated reply IDs: " + JSON.stringify(permittedReplies),
        "Earlier STM/LTM (untrusted reference): " + JSON.stringify(previous).slice(-10000),
      ].join("\n\n");
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          metadataRepair: true, repairChat: needsChat, repairMemory,
          allowedCastIds: permittedReplies, memoryMode: "lime",
          memoryTurnCount: parseLocalMemoryEntries(previous.stm).length,
          provider, model, uiLanguage: locale, contextWindowTokens,
          messages: [{ role: "user", content: prompt }],
          debugRequestPayload: terminalRequestLogEnabled,
          debugFullOutput: terminalLogEnabled,
        }),
      });
      if (!response.ok || !response.body) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "VIAE 补齐请求失败");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      while (raw.length < 35000) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
      const repairedMemory = repairMemory ? parseStoryTurnMemory(raw) : null;
      if (repairMemory && (!repairedMemory?.stm ||
          (parseLocalMemoryEntries(previous.stm).length >= LOCAL_STM_SLOTS && !repairedMemory.ltm))) {
        throw new Error("模型没有返回完整的 STM/LTM");
      }
      let restoredChat = rawChat;
      if (needsChat) {
        const block = raw.match(/<viae_chat>\s*([\s\S]*?)<\/viae_chat>/i);
        if (!block) throw new Error("模型未补齐 viae_chat");
        const items: unknown = JSON.parse(block[1]);
        if (!Array.isArray(items) || !items.length || !items.every(item =>
          item && typeof item === "object" && typeof item.charId === "string" &&
          permittedReplies.includes(item.charId) && typeof item.text === "string" && item.text.trim())) {
          throw new Error("模型补齐的角色消息格式不正确");
        }
        restoredChat = "<viae_chat>" + JSON.stringify(items) + "</viae_chat>";
      }
      const latest = activeGroupRef.current;
      if (latest?.id !== activeGroup.id || index !== latest.messages.length - 1
          || latest.messages[index]?.id !== target.id
          || latest.messages[index]?.content !== target.content
          || !latest.messages[index]?.metadataRepairMissing
          || (latest.stm || "") !== previous.stm || (latest.ltm || "") !== previous.ltm) {
        throw new Error("道路会话已改变，过期的补齐结果已丢弃");
      }
      patchGroup(activeGroup.id, group => {
        const live = group.messages[index];
        if (index !== group.messages.length - 1 || live?.id !== target.id ||
            live?.content !== target.content || !live.metadataRepairMissing ||
            (group.stm || "") !== previous.stm || (group.ltm || "") !== previous.ltm) return group;
        const memory = repairedMemory ? nextConversationMemory(previous, repairedMemory) : null;
        if (repairMemory && !memory) return group;
        return {
          ...group,
          ...(memory ? { stm: memory.stm, ltm: memory.ltm, turnCount: memory.turnCount } : {}),
          updatedAt: Date.now(),
          messages: group.messages.map((msg, i) => i === index
            ? { ...msg, content: restoredChat, metadataRepairMissing: false, memoryRepairMissing: false } : msg),
        };
      });
      dialog.notify("VIAE 状态补齐成功。", { tone: "viae", type: "success" });
    } catch (error) {
      if (!controller.signal.aborted) dialog.notify("VIAE 状态补齐失败：" +
        (error instanceof Error ? error.message : String(error)), { tone: "viae", type: "error" });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      busyRef.current = false;
      setIsLoading(false);
    }
  };

  /**
   * Editing is intentionally restricted to user/director messages.
   * Assistant bubble editing is paused until edits can reconcile STM/LTM
   * and later generated dialogue without corrupting continuity.
   */
  const editMessage = (index: number, revised: string): boolean => {
    if (!activeGroup || busyRef.current || isLoading) return false;
    const target = activeGroup.messages[index];
    const text = revised.trim();
    if (!target || target.role !== "user" || !text || text.length > 5000) return false;
    if (text === target.content) return true;
    const messageId = target.id;
    patchGroup(activeGroup.id, group => {
      const live = group.messages[index];
      if (!live || live.id !== messageId || live.role !== "user") return group;
      return {
        ...group,
        messages: group.messages.map((message, i) => {
          if (i === index) return { ...message, content: text };
          // Existing generated turns and memory remain untouched. Only mark
          // the immediate assistant response as stale for optional refresh.
          if (i === index + 1 && message.role === "assistant")
            return { ...message, needsRegeneration: true };
          return message;
        }),
        updatedAt: Date.now(),
      };
    });
    return true;
  };

  const deleteMessage = (index: number) => {
    if (!activeGroup || busyRef.current) return;
    patchGroup(activeGroup.id, group => ({ ...group, messages: group.messages.filter((_, i) => i !== index) }));
  };
  return { activeGroup, input, setInput, isLoading, send, stop, deleteMessage, editMessage, repairMessage };
}
