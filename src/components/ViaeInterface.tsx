"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Brain, Check, ChevronRight, Compass, Copy,
  GitMerge, MapPin, Pencil, RotateCcw, Route, Search,
  Send, Settings2, Sparkles, Square, Trash2, Users, Volume2, X, Save, AlertTriangle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ViaeConversation, Session } from "../types";
import type { PublicLocalProvider, LocalModelGroup } from "../lib/localProviders";
import { useSavedModels } from "../hooks/useSavedModels";
import { MemoryVaultModal } from "./MemoryVaultModal";
import { useViaeEngine } from "../hooks/useViaeEngine";
import { ViaeWorldlineEditor } from "./ViaeWorldlineEditor";
import { parseStoryWorldline, worldlineFor, describeStoryWorldline, BANG_DREAM_WORLD_ID } from "../lib/storyWorldline";
import { viaeWorldline } from "../lib/viaeWorldline";
import { canExtendWorldline } from "../lib/worldlineLock";
import { storyCastAllowed } from "../lib/storyCast";
import type { ChartaWorld } from "../lib/chartaWorld";
import type { ChartaSelf } from "../lib/chartaSelf";
import { useLanguage } from "../context/LanguageContext";
import { useAppDialog } from "../context/DialogContext";
import { characterDisplayName } from "../lib/characterNames";
import { deepText } from "../lib/i18nDeep";
import { DEFAULT_CONTEXT_WINDOW_TOKENS } from "../lib/contextWindow";

// Historical Local JSON keeps `limeGroups`, `limeGroupId`, and memoryMode="lime".
// Viae, Semita, and Compitum are presentation names, not a save-format migration.
const GOLD = "#bb9b61";
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const asText = (value: unknown): string => typeof value === "string" ? value : String(value ?? "");
const parseSpeakers = (content: string): { charId: string; text: string }[] => {
  const match = content.match(/<(?:viae_chat|lime_chat)>\s*([\s\S]*?)\s*<\/(?:viae_chat|lime_chat)>/i);
  if (!match) return [{ charId: "", text: content }];
  try {
    const decoded: unknown = JSON.parse(match[1]);
    if (!Array.isArray(decoded)) return [{ charId: "", text: content }];
    const segments = decoded.filter(x => x && typeof x === "object" && typeof x.text === "string")
      .map(x => ({ charId: typeof x.charId === "string" ? x.charId : "", text: x.text as string }));
    return segments.length ? segments : [{ charId: "", text: content }];
  } catch { return [{ charId: "", text: content }]; }
};
const kindName = (group: ViaeConversation, locale: import("../lib/locale").Locale) => deepText(locale, group.type === "direct" ? "viae.kindDirect" : "viae.kindGroup");
const routeName = (group: ViaeConversation, locale?: string) => describeStoryWorldline(viaeWorldline(group), locale);

function PathEmblem({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="20" stroke={GOLD} strokeWidth="0.8" opacity="0.7"/>
      <path d="M8 36 C12 29 22 29 23 20 S30 12 36 7" stroke={GOLD} strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 37 C16 31 27 30 27 20 S30 13 36 7" stroke="#efe4cb" strokeWidth="1" opacity="0.75"/>
      <circle cx="23" cy="20" r="2" fill={GOLD}/>
      <path d="M12 10 L13.3 13.7 L17 15 L13.3 16.3 L12 20 L10.7 16.3 L7 15 L10.7 13.7 Z" fill={GOLD}/>
      <circle cx="32" cy="30" r="1.3" fill={GOLD}/>
    </svg>
  );
}

function RouteIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 620 128" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      <path d="M-10 106 C91 106 93 26 203 61 S344 147 427 77 S542 58 647 -6" stroke="#e0c48c" strokeWidth={compact ? 1 : 1.65} opacity="0.7"/>
      <path d="M-15 118 C83 118 101 42 197 79 S333 157 439 91 S540 66 641 7" stroke="#d9c391" strokeWidth="0.8" opacity="0.25"/>
      <path d="M-8 20 Q184 -25 320 31 T640 6" stroke="#b8a37c" strokeWidth="0.8" strokeDasharray="2 8" opacity="0.35"/>
      <g fill="#e6c991"><circle cx="202" cy="61" r="3"/><circle cx="426" cy="78" r="3"/><circle cx="532" cy="57" r="2"/></g>
      <path d="M505 19 L507 24 L512 26 L507 28 L505 33 L503 28 L498 26 L503 24 Z" fill="#f0d7a6" opacity="0.85"/>
    </svg>
  );
}

interface ViaeProps {
  session: Session;
  updateSession: (updater: (current: Session) => Session) => void;
  characters: { id: string; name: string; avatar: string; hex: string; sub?: string }[];
  customCharacters?: import("../lib/charta").ChartaCharacter[];
  worlds?: ChartaWorld[];
  activeSelf?: ChartaSelf | null;
  onExit: () => void;
  onSettings: () => void;
  onManualSync?: () => void;
  syncStatus?: string;
  providers: PublicLocalProvider[];
  provider: string;
  onProviderChange: (next: string) => void;
  model: string;
  customModel: string;
  onModelChange: (next: string) => void;
  onCustomModelChange: (next: string) => void;
  notify: (message: string) => void;
  terminalRequestLogEnabled?: boolean;
  terminalLogEnabled?: boolean;
  contextWindowTokens?: number;
}

export function ViaeInterface({ session, updateSession, characters, customCharacters = [], worlds = [], activeSelf = null, onExit, onSettings, onManualSync, syncStatus, providers, provider, onProviderChange, model, customModel, onModelChange, onCustomModelChange, notify, terminalRequestLogEnabled = false, terminalLogEnabled = false, contextWindowTokens = DEFAULT_CONTEXT_WINDOW_TOKENS }: ViaeProps) {
  const { locale } = useLanguage();
  const dialog = useAppDialog();
  const { activeGroup, input, setInput, isLoading, send, stop, deleteMessage, editMessage, repairMessage } = useViaeEngine({
    session, updateSession, provider, model: customModel.trim() || model, notify, customCharacters, activeSelf, terminalRequestLogEnabled, terminalLogEnabled, contextWindowTokens,
  });
  const confirmStopGeneration = async () => {
    if (await dialog.confirm(deepText(locale, "viae.actions.stopConfirm"), { destructive: true })) stop();
  };
  const [editingBubble, setEditingBubble] = useState<{ id: string; index: number; draft: string } | null>(null);
  const startBubbleEdit = (messageId: string, index: number, draft: string) => {
    if (isLoading) return;
    setEditingBubble({ id: messageId, index, draft });
  };
  const confirmBubbleEdit = async () => {
    if (!editingBubble || isLoading || !activeGroup) return;
    const edit = editingBubble;
    const target = activeGroup.messages[edit.index];
    if (!target || target.id !== edit.id || target.role !== "user") { setEditingBubble(null); return; }
    if (!edit.draft.trim()) {
      dialog.notify(deepText(locale, "viae.actions.empty"), { type: "warning", tone: "viae" }); return;
    }
    if (edit.draft.trim().length > 5000) {
      dialog.notify(deepText(locale, "viae.actions.tooLong"), { type: "warning", tone: "viae" }); return;
    }
    const historical = edit.index < activeGroup.messages.length - 2;
    const accepted = await dialog.confirm(
      historical
        ? deepText(locale, "viae.actions.editOld")
        : deepText(locale, "viae.actions.editCurrent"),
      { title: `VIAE · ${deepText(locale, "viae.actions.editTitle")}`, tone: "viae", confirmLabel: deepText(locale, "viae.actions.saveEdit"), preview: edit.draft.trim() },
    );
    if (!accepted || isLoading) return;
    if (!activeGroup || activeGroup.messages[edit.index]?.id !== edit.id) return;
    const saved = editMessage(edit.index, edit.draft);
    if (saved) {
      setEditingBubble(null);
      dialog.notify(deepText(locale, "viae.actions.edited"), { type: "success", tone: "viae" });
    } else dialog.notify(deepText(locale, "viae.actions.editFailed"), { type: "error", tone: "viae" });
  };
  const confirmRefresh = async () => {
    if (!activeGroup || isLoading) return;
    const last = activeGroup.messages[activeGroup.messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const refreshPrompt = last.viaeTurnBefore
      ? deepText(locale, "viae.actions.refreshCurrent")
      : deepText(locale, "viae.actions.refreshLegacy");
    if (!await dialog.confirm(refreshPrompt,
      { title: `VIAE · ${deepText(locale, "viae.actions.refreshTitle")}`, tone: "viae", confirmLabel: deepText(locale, "common.retry") })) return;
    if (!isLoading) {
      setEditingBubble(null);
      void send(true);
    }
  };
  const [creating, setCreating] = useState(false);
  useEffect(() => { setEditingBubble(null); }, [activeGroup?.id]);
  const [kind, setKind] = useState<"direct" | "group">("direct");
  const [selected, setSelected] = useState<string[]>([]);
  const [draftName, setDraftName] = useState("");
  const [reality, setReality] = useState<"canon" | "au">("canon");
  const [timeline, setTimeline] = useState("5-6");
  const [auContext, setAuContext] = useState("");
  const [pov, setPov] = useState<"outsider" | "insider">("outsider");
  const [openMemory, setOpenMemory] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showRouteEditor, setShowRouteEditor] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [modelGroups, setModelGroups] = useState<LocalModelGroup[]>([]);
  const [copyIndex, setCopyIndex] = useState<number | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [routeDraft, setRouteDraft] = useState(worldlineFor(null));
  const [draftWorldline, setDraftWorldline] = useState(worldlineFor(null));
  const [worldFilter, setWorldFilter] = useState("all");
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const conversations = session.limeGroups || [];
  const participantAvailable = Boolean(activeSelf);
  const memberOrigin = (id: string): string | null =>
    customCharacters.find(c => c.id === id)?.worldId ||
      (characters.some(c => c.id === id) ? (customCharacters.some(c => c.id === id) ? null : BANG_DREAM_WORLD_ID) : null);
  const draftValidWorldline = parseStoryWorldline(draftWorldline);
  const allowedToSelect = (id: string) => Boolean(draftValidWorldline && storyCastAllowed({ id, worldId: memberOrigin(id) }, draftValidWorldline));
  const availableDraftCharacters = characters.filter(c => allowedToSelect(c.id));
  const multiWorld = Boolean(draftValidWorldline?.crossWorld?.enabled && draftValidWorldline.crossWorld.secondary.length);
  const shownDraftCharacters = availableDraftCharacters.filter(c => worldFilter === "all" || (worldFilter === "universal" ? memberOrigin(c.id) === null : memberOrigin(c.id) === worldFilter));
  const worldNameFor = (id: string | null): string =>
    !id ? deepText(locale, "viae.roleWorldNeutral") : id === BANG_DREAM_WORLD_ID ? "BanG Dream!" : worlds.find(w => w.id === id)?.name || deepText(locale, "viae.roleUnknownWorld");
  const providerConfigured = providers.some(p => p.id === provider);
  const who = (id: string) => {
    const c = characters.find(c => c.id === id);
    return c ? { ...c, name: characterDisplayName(c.id, c.name, locale) } : undefined;
  };
  const time = (value?: number) => mounted && value ? new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "";

  useEffect(() => { setMounted(true); return () => currentAudio.current?.pause(); }, []);
  useEffect(() => {
    // The navigation always opens on VIAE's own cover page; old groups remain untouched.
    updateSession(current => current.limeGroupId ? { ...current, limeGroupId: null } : current);
    // Only on mounting VIAE. Avoid resetting the user's selection during a chat.
  }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [activeGroup?.id, activeGroup?.messages.length]);
  useEffect(() => {
    let alive = true;
    if (!provider || provider.startsWith("custom_")) { setModelGroups([]); return; }
    fetch(`/api/providers?models=${encodeURIComponent(provider)}`, { cache: "no-store" })
      .then(r => r.json()).then(data => { if (alive) setModelGroups(Array.isArray(data.groups) ? data.groups : []); })
      .catch(() => { if (alive) setModelGroups([]); });
    return () => { alive = false; };
  }, [provider]);

  const updateGroup = (id: string, update: (group: ViaeConversation) => ViaeConversation) => {
    updateSession(current => ({ ...current, updatedAt: Date.now(), limeGroups: (current.limeGroups || []).map(g => g.id === id ? update(g) : g) }));
  };
  const chooseGroup = (id: string | null) => {
    if (isLoading) { notify(deepText(locale, "viae.ui.busy")); return; }
    // Selecting the active path again takes the reader back to the VIAE overview.
    const nextId = id && id === session.limeGroupId ? null : id;
    updateSession(current => ({ ...current, limeGroupId: nextId, updatedAt: Date.now() }));
    setCreating(false); setOpenMemory(false); setShowModels(false); setShowManage(false); setShowRouteEditor(false); setShowDetails(false);
  };
  const resetCreate = (nextKind: "direct" | "group") => {
    setKind(nextKind); setSelected([]); setDraftName(""); setAuContext(""); setReality("canon"); setTimeline("5-6"); setDraftWorldline(worldlineFor(null)); setWorldFilter("all"); setPov("outsider"); setCreating(true);
  };
  const create = () => {
    const validWorldline = parseStoryWorldline(draftWorldline);
    if (!validWorldline) { notify(deepText(locale, "viae.ui.worldlineIncomplete")); return; }
    if (pov === "insider" && !participantAvailable) { notify(deepText(locale, "viae.createRequiresSelf")); return; }
    if (selected.some(id => !storyCastAllowed({ id, worldId: memberOrigin(id) }, validWorldline))) {
      notify(deepText(locale, "viae.ui.memberWorldMismatch")); return;
    }
    const expected = kind === "direct" ? (pov === "outsider" ? 2 : 1) : 2;
    if (kind === "direct" ? selected.length !== expected : selected.length < expected) {
      notify(deepText(locale, kind === "direct" ? (pov === "outsider" ? "viae.ui.requireObserveTwo" : "viae.ui.requireParticipateOne") : "viae.ui.requireGroupTwo"));
      return;
    }
    const name = draftName.trim().slice(0, 70) || (kind === "direct"
      ? (pov === "outsider" ? selected.map(id => who(id)?.name || id).join(" · ") : who(selected[0])?.name || deepText(locale, "viae.untitledDirect"))
      : deepText(locale, "viae.untitledGroup"));
    const group: ViaeConversation = {
      id: makeId(), name, type: kind, members: [...selected], pov,
      defaultPovChar: selected[0], storyWorldline: validWorldline,
      reality: validWorldline.kind, timeline: validWorldline.kind === "canon" ? validWorldline.period.replace(/^T-/, "") : "AU",
      auContext: reality === "au" ? auContext.trim() : "", messages: [],
      stm: "", ltm: "", turnCount: 0, updatedAt: Date.now(),
    };
    updateSession(current => ({ ...current, limeGroups: [group, ...(current.limeGroups || [])], limeGroupId: group.id, updatedAt: Date.now() }));
    setCreating(false); setSelected([]); setDraftName(""); setAuContext("");
  };
  const removeGroup = async (id: string) => {
    if (isLoading || !await dialog.confirm(deepText(locale, "viae.ui.deletePathAsk"))) return;
    updateSession(current => ({ ...current, limeGroups: (current.limeGroups || []).filter(g => g.id !== id), limeGroupId: current.limeGroupId === id ? null : current.limeGroupId, updatedAt: Date.now() }));
  };
  const rename = async (group: ViaeConversation) => {
    const name = (await dialog.prompt(deepText(locale, "viae.ui.renameAsk"), group.name))?.trim();
    if (name) updateGroup(group.id, g => ({ ...g, name: name.slice(0, 70), updatedAt: Date.now() }));
  };
  const toggleMember = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (kind === "group") return [...prev, id];
      const limit = pov === "outsider" ? 2 : 1;
      return prev.length >= limit ? (limit === 1 ? [id] : prev) : [...prev, id];
    });
  };
  const changeDraftPov = (next: "outsider" | "insider") => {
    if (next === "insider" && !participantAvailable) { notify(deepText(locale, "viae.ui.selfNeeded")); return; }
    setPov(next);
    if (kind === "direct" && next === "insider") setSelected(prev => prev.slice(0, 1));
  };
  const changeViewpoint = (id: string) => {
    if (!activeGroup || isLoading || !activeGroup.members.includes(id)) return;
    updateGroup(activeGroup.id, group => ({ ...group, defaultPovChar: id, updatedAt: Date.now() }));
  };
  const changeExistingMode = (next: "outsider" | "insider") => {
    if (!activeGroup || isLoading || next === activeGroup.pov) return;
    if (next === "insider" && !participantAvailable) { notify(deepText(locale, "viae.ui.selfActivate")); return; }
    if (activeGroup.type === "direct" && activeGroup.messages.length > 0) {
      notify(deepText(locale, "viae.tools.historyLock"));
      return;
    }
    if (activeGroup.type === "direct") {
      const required = next === "outsider" ? 2 : 1;
      if (activeGroup.members.length !== required) { notify(deepText(locale, next === "outsider" ? "viae.tools.requireTwo" : "viae.tools.requireOne")); return; }
    }
    updateGroup(activeGroup.id, group => ({ ...group, pov: next, updatedAt: Date.now() }));
  };
  const editRoute = () => {
    if (!activeGroup) return;
    setRouteDraft(viaeWorldline(activeGroup));
    setShowRouteEditor(true); setShowModels(false); setShowManage(false); setShowDetails(false);
  };
  const saveRoute = () => {
    if (!activeGroup || isLoading) return;
    const parsed = parseStoryWorldline(routeDraft);
    if (!parsed) { notify(deepText(locale, "viae.ui.routeIncomplete")); return; }
    if (!canExtendWorldline(viaeWorldline(activeGroup), parsed)) {
      notify(deepText(locale, "viae.ui.routeLocked")); return;
    }
    if (activeGroup.members.some(id => !storyCastAllowed({ id, worldId: memberOrigin(id) }, parsed))) {
      notify(deepText(locale, "viae.ui.routeMissingMembers")); return;
    }
    updateGroup(activeGroup.id, g => ({ ...g, storyWorldline: parsed, reality: parsed.kind,
      timeline: parsed.kind === "canon" ? parsed.period.replace(/^T-/, "") : "AU", updatedAt: Date.now() }));
    setShowRouteEditor(false); notify(deepText(locale, "viae.actions.routeSaved"));
  };
  const playVoice = async (text: string, id: string) => {
    if (voiceBusy || !text.trim() || !id) return;
    setVoiceBusy(true);
    let url: string | null = null;
    try {
      currentAudio.current?.pause();
      const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, characterId: id, variant: "default" }) });
      if (!response.ok) throw new Error(deepText(locale, "viae.ui.ttsUnavailable"));
      url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      currentAudio.current = audio;
      const release = () => { if (url) URL.revokeObjectURL(url); setVoiceBusy(false); };
      audio.onended = release;
      audio.onerror = () => { release(); notify(deepText(locale, "viae.ui.voicePlaybackFailed")); };
      await audio.play();
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      setVoiceBusy(false);
      notify(error instanceof Error ? error.message : deepText(locale, "viae.ui.voiceGenerationFailed"));
    }
  };
  const availableModels = useMemo(() => modelGroups.flatMap(group => group.models || []), [modelGroups]);
  const { savedModels, saveModel, forgetModel } = useSavedModels();
  const savedIds = savedModels[provider] || [];
  const filtered = useMemo(() => conversations.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase())), [conversations, search]);
  const memberLabel = activeGroup?.members.map(id => who(id)?.name || id).join("、") || "";
  const eligibleManage = characters.filter(char => activeGroup && storyCastAllowed({ id: char.id, worldId: memberOrigin(char.id) }, viaeWorldline(activeGroup)));
  const isObserving = activeGroup?.pov === "outsider";
  const viewChar = activeGroup ? who(activeGroup.members.includes(activeGroup.defaultPovChar || "") ? activeGroup.defaultPovChar! : activeGroup.members[0]) : undefined;

  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[#fafaf9] font-sans text-[#1b2e48]">
      {/* Shared Viae directory — deliberately separate from the Engineering/Story/Chat explorer. */}
      <aside className={`relative z-20 flex w-full shrink-0 flex-col border-r border-[#e5e8eb] bg-white sm:w-[318px] lg:w-[340px] ${activeGroup || creating ? "hidden sm:flex" : "flex"}`}>
        <div className="flex items-center gap-3 border-b border-[#e9edf0] px-5 py-5">
          <button type="button" onClick={onExit} title={deepText(locale, "viae.choosePath")} aria-label={deepText(locale, "viae.choosePath")} className="rounded-xl p-2 text-[#586d81] transition hover:bg-[#f2f5f7]"><ArrowLeft size={18}/></button>
          <button type="button" onClick={() => chooseGroup(null)} title={`VIAE · ${deepText(locale, "viae.choosePath")}`} aria-label={`VIAE · ${deepText(locale, "viae.choosePath")}`} className="rounded-xl transition hover:ring-2 hover:ring-[#e5d5b4]"><img src="/shiorivia-app-icon.png" alt="Shiorivia" className="h-10 w-10 rounded-xl object-cover"/></button>
          <div className="min-w-0 flex-1"><h1 className="font-semibold tracking-[0.18em] text-[#162942]">VIAE</h1><p className="text-[10px] tracking-wide text-[#8994a1]">SHIORIVIA · CHARACTER MESSAGING</p></div>
<button type="button" onClick={onSettings} title={deepText(locale, "common.settings")} aria-label={deepText(locale, "common.settings")} className="rounded-xl p-2 text-[#718095] hover:bg-[#f3f5f7]"><Settings2 size={18}/></button>
        </div>
        <div className="px-5 pb-3 pt-6">
          <div className="mb-4 flex items-center justify-between"><span className="text-[10px] font-semibold tracking-[0.18em] text-[#8290a0]">YOUR PATHS / {deepText(locale, "viae.paths")}</span><span className="text-xs text-[#b49a6c]">{conversations.length.toString().padStart(2, "0")}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => resetCreate("direct")} className="flex items-center justify-center gap-2 rounded-xl border border-[#e4e8eb] bg-[#f9fafb] px-2 py-3 text-xs font-semibold text-[#253c59] transition hover:border-[#c8b58f] hover:bg-[#fffdf8]"><Route size={16} color={GOLD}/> {deepText(locale, "viae.actionOpen")} <span className="font-normal text-[#8e9aaa]">Semita</span></button>
            <button type="button" onClick={() => resetCreate("group")} className="flex items-center justify-center gap-2 rounded-xl border border-[#e4e8eb] bg-[#f9fafb] px-2 py-3 text-xs font-semibold text-[#253c59] transition hover:border-[#c8b58f] hover:bg-[#fffdf8]"><GitMerge size={16} color={GOLD}/> {deepText(locale, "viae.actionCreate")} <span className="font-normal text-[#8e9aaa]">Compitum</span></button>
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-[#e8ebed] bg-[#fbfbfb] px-3 py-2.5 text-[#a2abb6]"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={deepText(locale, "viae.search")} className="w-full bg-transparent text-xs text-[#263a51] outline-none placeholder:text-[#a2abb6]"/></label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
          {filtered.length === 0 && <p className="px-4 py-12 text-center text-xs leading-7 text-[#99a4b0]">{deepText(locale, "viae.empty")}</p>}
          {filtered.map(g => {
            const last = g.messages?.[g.messages.length - 1];
            const participant = who(g.members[0]);
            return <div key={g.id} className={`group mb-1 flex items-center rounded-xl border px-2 py-1.5 transition ${g.id === session.limeGroupId ? "border-[#dce5ef] bg-[#f4f7fa]" : "border-transparent hover:bg-[#f8f9fa]"}`}>
              <button type="button" onClick={() => chooseGroup(g.id)} className="flex min-w-0 flex-1 items-center gap-3 p-1.5 text-left">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${g.type === "direct" ? "bg-[#f4f3ee]" : "bg-[#eaf0f5] text-[#49617c]"}`}>{g.type === "direct" ? participant?.avatar || "✦" : <GitMerge size={21}/>}</span>
                <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-1"><span className="truncate text-[13px] font-semibold">{g.name}</span><span className="shrink-0 text-[10px] text-[#a6afba]">{time(g.updatedAt)}</span></span><span className="mt-1 block truncate text-[11px] text-[#8995a3]">{last ? (last.role === "user" ? `${deepText(locale, "common.you")}：${asText(last.content)}` : (parseSpeakers(asText(last.content))[0]?.text || deepText(locale, "viae.newMessage"))) : kindName(g, locale)}</span></span>
              </button>
              <button type="button" title={`${deepText(locale, "viae.removePath")} ${g.name}`} aria-label={`${deepText(locale, "viae.removePath")} ${g.name}`} disabled={isLoading} onClick={() => removeGroup(g.id)} className="rounded-lg p-1.5 text-[#a5afba] opacity-60 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={14}/></button>
            </div>;
          })}
        </div>
        <div className="border-t border-[#e8edf1] bg-[#fbfcfd] px-5 py-3">
          <button type="button" onClick={onManualSync}
            disabled={!onManualSync || isLoading || syncStatus === "syncing"}
            title={deepText(locale, "viae.actions.localSaveHint")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d8e0e8] bg-white px-4 py-2.5 text-xs font-semibold text-[#3a526b] transition hover:border-[#c2af89] hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-40">
            <Save size={15}/> {syncStatus === "syncing" ? deepText(locale, "viae.actions.saving") : deepText(locale, "viae.actions.localSave")}
          </button>
        </div>
        <div className="relative overflow-hidden bg-[#152841] px-5 py-5 text-[#e8d3aa]"><RouteIllustration compact/><div className="relative z-10 flex items-center gap-3"><PathEmblem size={35}/><div><p className="font-serif text-sm italic">Where stories find their way.</p><p className="mt-1 text-[9px] tracking-widest text-[#9baabe]">SHIORIVIA / VIAE</p></div></div></div>
      </aside>

      {/* The center panel keeps the content almost entirely white. */}
      <main className={`flex min-w-0 flex-1 flex-col bg-[#fcfcfb] ${activeGroup || creating ? "flex" : "hidden sm:flex"}`}>
        {creating ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <header className="flex items-center gap-3 border-b border-[#e9edf0] bg-white px-5 py-5"><button onClick={() => setCreating(false)} aria-label={deepText(locale, "viae.paths")} className="rounded-lg p-2 text-[#64758c] hover:bg-[#f4f6f8]"><ArrowLeft size={18}/></button><PathEmblem size={30}/><div><h2 className="text-base font-semibold">{deepText(locale, kind === "direct" ? "viae.startDirect" : "viae.startGroup")}</h2><p className="text-xs text-[#96a1ad]">{kind === "direct" ? "Semita" : "Compitum"} · {deepText(locale, kind === "direct" ? "viae.directDesc" : "viae.groupDesc")}</p></div></header>
            <div className="mx-auto w-full max-w-2xl space-y-6 px-5 py-8 sm:px-8">
              <div className="grid grid-cols-2 gap-3">{(["direct", "group"] as const).map(choice => <button key={choice} type="button" onClick={() => { setKind(choice); setSelected([]); setPov("outsider"); }} className={`rounded-2xl border p-4 text-left transition ${kind === choice ? "border-[#bdad91] bg-[#fffdfa]" : "border-[#e4e9ef] bg-white hover:border-[#bdad91]"}`}><span className="mb-3 inline-flex rounded-xl bg-[#edf2f6] p-2 text-[#29415e]">{choice === "direct" ? <Route size={21}/> : <GitMerge size={21}/>}</span><span className="block text-sm font-semibold">{deepText(locale, choice === "direct" ? "viae.kindDirect" : "viae.kindGroup")}</span><span className="mt-1 block text-xs leading-5 text-[#8e9aaa]">{choice === "direct" ? deepText(locale, "viae.createOnlyOne") : deepText(locale, "viae.createGroupHint")}</span></button>)}</div>
              <label className="block space-y-2"><span className="text-xs font-semibold text-[#52667f]">{deepText(locale, "viae.name")}</span><input maxLength={70} value={draftName} onChange={e => setDraftName(e.target.value)} placeholder={deepText(locale, kind === "direct" ? "viae.nameDefault" : "viae.nameExample")} className="w-full rounded-xl border border-[#e2e7eb] bg-white px-4 py-3 text-sm outline-none focus:border-[#bba26d]"/></label>
              <section className="rounded-2xl border border-[#e5e9ec] bg-[#f9faf9] p-4">
                <ViaeWorldlineEditor value={draftWorldline} worlds={worlds}
                  onChange={next => {
                    setDraftWorldline(next); setWorldFilter("all");
                    const valid = parseStoryWorldline(next);
                    setSelected(prev => prev.filter(id => valid && storyCastAllowed({ id, worldId: memberOrigin(id) }, valid)));
                  }} />
              </section>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#52667f]">{deepText(locale, "viae.mode")}</span>
                <div className="flex flex-wrap gap-2">{(["outsider", "insider"] as const).map(value =>
                  <button key={value} type="button" disabled={value === "insider" && !participantAvailable}
                    onClick={() => changeDraftPov(value)}
                    className={`rounded-lg border px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${pov === value ? "border-[#bba26d] bg-[#fffaf0] text-[#6f5b36]" : "border-[#e4e9ee] text-[#718296]"}`}>
                    {deepText(locale, value === "outsider" ? "viae.outsider" : "viae.insider")}
                  </button>)}</div>
                {!participantAvailable && <p className="text-[11px] text-[#a08b69]">{deepText(locale, "viae.createRequiresSelf")}</p>}
                <p className="text-[11px] leading-5 text-[#8a98a8]">{deepText(locale,
                  pov === "outsider" ? (kind === "direct" ? "viae.observeDirect" : "viae.observeGroup")
                    : (kind === "direct" ? "viae.joinDirect" : "viae.joinGroup"))}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#52667f]">{deepText(locale, "viae.members")}</span>
                  <span className="text-xs text-[#9fa9b5]">{deepText(locale, "viae.selected")} {selected.length}{kind === "direct" ? ` / ${pov === "outsider" ? 2 : 1}` : ""}</span>
                </div>
                {multiWorld && <label className="block text-[11px] text-[#8190a2]">{deepText(locale, "viae.createWorldFilter")}
                  <select value={worldFilter} onChange={e => setWorldFilter(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#e2e7eb] bg-white px-3 py-2 text-xs text-[#3d5572]">
                    <option value="all">{deepText(locale, "viae.createAllWorlds")}</option>
                    {[draftValidWorldline!.worldId, ...(draftValidWorldline!.crossWorld?.secondary.map(w => w.worldId) || [])].map(id =>
                      <option key={id} value={id}>{worldNameFor(id)}</option>)}
                    {draftValidWorldline!.crossWorld?.includeUniversal && <option value="universal">{deepText(locale, "viae.roleWorldNeutral")}</option>}
                  </select>
                </label>}
                <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {shownDraftCharacters.filter(c => worldFilter !== "universal" || memberOrigin(c.id) === null).map(char =>
                    <button type="button" key={char.id} onClick={() => toggleMember(char.id)}
                      className={`flex min-w-0 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition ${selected.includes(char.id) ? "border-[#bba26d] bg-[#fffaf0]" : "border-[#e9edf0] bg-white hover:border-[#cdd7e0]"}`}>
                      <span className="flex w-full items-center gap-2"><span className="text-lg">{char.avatar}</span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{characterDisplayName(char.id, char.name, locale)}</span>
                        {selected.includes(char.id) && <Check size={13} color={GOLD}/>}
                      </span>
                      <span className="max-w-full truncate rounded bg-[#eef1f4] px-1.5 py-0.5 text-[9px] text-[#7f90a1]">{worldNameFor(memberOrigin(char.id))}</span>
                    </button>)}
                </div>
                {!draftValidWorldline && <p className="text-xs text-[#9b8b71]">{deepText(locale, "viae.createNeedWorld")}</p>}
              </div>
              {pov === "outsider" && selected.length > 0 && <label className="block space-y-2">
                <span className="text-xs font-semibold text-[#52667f]">{deepText(locale, "viae.viewpoint")} / Viewpoint</span>
                <p className="text-[11px] text-[#8a98a8]">{deepText(locale, "viae.viewHelp")}</p>
                <span className="block rounded-xl border border-[#e2e7eb] bg-white px-3">
                  <select value={selected[0]} onChange={e => setSelected(prev => [e.target.value, ...prev.filter(id => id !== e.target.value)])}
                    className="w-full bg-transparent py-3 text-sm text-[#263a51] outline-none">
                    {selected.map(id => <option key={id} value={id}>{who(id)?.name || id}</option>)}
                  </select>
                </span>
              </label>}
              <button type="button" onClick={create} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#182e49] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#294562]"><Sparkles size={16} color="#e8cc97"/> {deepText(locale, kind === "direct" ? "viae.createDirect" : "viae.createGroup")}</button>
            </div>
          </div>
        ) : activeGroup ? (
          <>
            <header className="flex min-h-[76px] items-center gap-3 border-b border-[#e9edf0] bg-white px-4 sm:px-6">
              <button type="button" onClick={() => chooseGroup(null)} aria-label={deepText(locale, "viae.ui.backOverview")} title={deepText(locale, "viae.ui.backOverview")} className="rounded-lg p-2 text-[#667b91] hover:bg-[#f4f6f8]"><ArrowLeft size={18}/></button>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#edf2f6] text-[#29415e]">{activeGroup.type === "direct" ? who(activeGroup.members[0])?.avatar || <Route size={21}/> : <GitMerge size={21}/>}</span>
              <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-[#1e3048]">{activeGroup.name}</h2><p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-[#8493a4]"><MapPin size={11} color={GOLD}/>{kindName(activeGroup, locale)} <span className="text-[#c4cad1]">·</span> {routeName(activeGroup, locale)}</p></div>
              {isObserving && <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#e8e1d4] bg-[#fffdf8] px-2 py-1.5 text-[11px] text-[#7b6849]"><Compass size={14}/><span className="hidden md:inline">{deepText(locale, "viae.ui.phoneViewpoint")}</span><select disabled={isLoading} value={activeGroup.members.includes(activeGroup.defaultPovChar || "") ? activeGroup.defaultPovChar : activeGroup.members[0]} onChange={e => changeViewpoint(e.target.value)} aria-label={deepText(locale, "viae.ui.changePhoneViewpoint")} className="max-w-[100px] bg-transparent text-xs font-medium text-[#334b66] outline-none disabled:opacity-50">{activeGroup.members.map(id => <option key={id} value={id}>{who(id)?.name || id}</option>)}</select></label>}
              <button type="button" onClick={() => setShowDetails(v => !v)} title={deepText(locale, "viae.headerDetails")} aria-label={deepText(locale, "viae.headerDetails")} className="rounded-xl p-2 text-[#5f7085] hover:bg-[#f4f6f8] xl:hidden"><Compass size={19}/></button>
              <button type="button" onClick={() => { setShowModels(v => !v); setShowManage(false); setShowRouteEditor(false); }} title={deepText(locale, "viae.models")} aria-label={deepText(locale, "viae.models")} className="rounded-xl p-2 text-[#61738a] hover:bg-[#f4f6f8]"><Settings2 size={19}/></button>
            </header>
            {showModels && <div className="z-10 space-y-3 border-b border-[#e7eaee] bg-white px-5 py-4 shadow-sm"><div className="flex items-center justify-between text-xs font-semibold"><span>{deepText(locale, "viae.models")}</span><button type="button" onClick={() => setShowModels(false)} title={deepText(locale, "viae.tools.closeModels")} aria-label={deepText(locale, "viae.tools.closeModels")}><X size={16}/></button></div><div className="grid grid-cols-2 gap-3"><label className="text-[11px] text-[#8492a2]">{deepText(locale, "viae.tools.provider")}<select value={provider} onChange={e => onProviderChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#e0e6eb] bg-white p-2 text-xs">{providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label className="text-[11px] text-[#8492a2]">{deepText(locale, "viae.tools.model")}<select value={!provider.startsWith("custom_") && availableModels.some(m => m.id === model) ? model : ""} onChange={e => onModelChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#e0e6eb] bg-white p-2 text-xs"><option value="">{deepText(locale, "novel.manual")}</option>{!provider.startsWith("custom_") && availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>{provider.startsWith("custom_") && <p className="text-[11px] text-[#8391a2]">{deepText(locale, "viae.ui.customProviderHint")}</p>}<input value={customModel} onChange={e => onCustomModelChange(e.target.value)} placeholder={deepText(locale, "viae.tools.customModel")} className="w-full rounded-lg border border-[#e0e6eb] px-3 py-2 text-xs outline-none focus:border-[#bba26d]"/><p className="text-[11px] text-[#8391a2]">{deepText(locale, "viae.tools.shared")}</p></div>}
            {showModels && <div className="z-10 border-b border-[#e7eaee] bg-[#fffdf8] px-5 py-3 space-y-2">
              <div className="flex gap-2"><button type="button" onClick={() => saveModel(provider, customModel)} disabled={!customModel.trim() || savedIds.includes(customModel.trim())} className="rounded-lg border border-[#dfd1b3] px-3 py-1.5 text-xs text-[#927647] disabled:opacity-40">{deepText(locale, "viae.ui.saveCustomModel")}</button><span className="self-center text-[10px] text-[#9a8a6a]">{deepText(locale, "viae.ui.currentProvider")} · {provider}</span></div>
              {savedIds.length > 0 && <div className="flex flex-wrap gap-2">
                {savedIds.map(id => <span key={id} className="inline-flex min-w-0 items-center gap-1 rounded-lg border border-[#e7e0d4] bg-white px-2 py-1 text-[10px] text-[#7d6b4c]">
                  <button type="button" onClick={() => onCustomModelChange(id)} title={id} className="max-w-[180px] truncate">{id} · {deepText(locale, "novel.toolbar.custom")}</button><button type="button" onClick={() => forgetModel(provider, id)} aria-label={`${deepText(locale, "novel.toolbar.removeModel")} ${id}`} className="opacity-60 hover:opacity-100">×</button>
                </span>)}
              </div>}
            </div>}
            <div className="relative mx-4 mt-4 overflow-hidden rounded-2xl bg-[#172b46] px-5 py-4 text-white sm:mx-6"><RouteIllustration/><div className="relative flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><PathEmblem size={34}/><div className="min-w-0"><p className="text-xs font-semibold tracking-wide text-[#f0dcb7]">{viaeWorldline(activeGroup).worldName}</p><p className="mt-1 truncate text-[11px] text-[#aab8cb]">{routeName(activeGroup)}</p></div></div><button type="button" onClick={editRoute} className="shrink-0 rounded-xl border border-[#bca778]/70 bg-[#172b46]/70 px-3 py-2 text-[11px] text-[#f3dbaa] transition hover:bg-white/10"><Route size={14} className="mr-1 inline"/> {deepText(locale, "viae.actions.route")}</button></div></div>
            {showRouteEditor && <section className="z-10 mx-4 mt-2 space-y-3 rounded-2xl border border-[#e2e7eb] bg-[#fffdfa] p-4 shadow-sm sm:mx-6">
              <div className="flex items-center justify-between text-xs font-semibold"><span>{deepText(locale, "viae.actions.manageRoute")}</span>
                <button type="button" onClick={() => setShowRouteEditor(false)} title={deepText(locale, "viae.ui.closeRouteEditor")} aria-label={deepText(locale, "viae.ui.closeRouteEditor")}><X size={16}/></button>
              </div>
              <ViaeWorldlineEditor value={routeDraft} onChange={setRouteDraft} worlds={worlds} saved={viaeWorldline(activeGroup)}/>
              <button type="button" disabled={isLoading} onClick={saveRoute}
                className="rounded-lg bg-[#1a314c] px-4 py-2 text-xs text-white disabled:opacity-50">{deepText(locale, "viae.actions.saveRoute")}</button>
            </section>}
            {showManage && <div className="z-10 mx-4 mt-2 space-y-3 rounded-xl border border-[#e5e9ed] bg-white p-4 shadow-sm sm:mx-6"><div className="flex items-center justify-between text-xs font-semibold"><span>{deepText(locale, "viae.tools.pathManage")}</span><button type="button" onClick={() => setShowManage(false)} title={deepText(locale, "viae.tools.closeManage")} aria-label={deepText(locale, "viae.tools.closeManage")}><X size={16}/></button></div><button onClick={() => rename(activeGroup)} type="button" className="flex items-center gap-2 rounded-lg border border-[#e0e4e8] px-3 py-2 text-xs"><Pencil size={14}/> {deepText(locale, "common.rename")}</button><p className="text-xs text-[#718195]">{memberLabel}</p><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] text-[#8390a0]">{deepText(locale, "viae.mode")}</span>{(["outsider", "insider"] as const).map(value => <button key={value} type="button" disabled={isLoading || activeGroup.pov === value || (value === "insider" && !participantAvailable)} onClick={() => changeExistingMode(value)} className={`rounded-lg border px-3 py-1.5 text-xs disabled:opacity-60 ${activeGroup.pov === value ? "border-[#baa573] bg-[#fffaf0] text-[#695836]" : "border-[#e4e9ee] bg-white text-[#748395]"}`}>{value === "outsider" ? deepText(locale, "viae.tools.observe") : deepText(locale, "viae.tools.participate")}</button>)}</div><p className="text-[11px] leading-5 text-[#96a1ad]">{activeGroup.type === "direct" ? deepText(locale, "viae.tools.directRules") : deepText(locale, "viae.tools.groupRules")}</p>{activeGroup.type === "direct" && activeGroup.messages.length === 0 && <div className="flex flex-wrap gap-2">{eligibleManage.filter(c => !activeGroup.members.includes(c.id)).map(c => <button key={c.id} type="button" disabled={isLoading || activeGroup.members.length >= 2} onClick={() => updateGroup(activeGroup.id, g => ({ ...g, members: [...g.members, c.id], updatedAt: Date.now() }))} className="rounded-full border border-[#e4e9ee] px-2 py-1 text-[11px] text-[#748395] disabled:opacity-40">+ {characterDisplayName(c.id, c.name, locale)}</button>)}{activeGroup.members.length > 1 && <button type="button" disabled={isLoading} onClick={() => updateGroup(activeGroup.id, g => ({ ...g, members: g.members.slice(0, 1), defaultPovChar: g.members[0], updatedAt: Date.now() }))} className="rounded-full border border-[#e5d8d8] px-2 py-1 text-[11px] text-rose-600">{deepText(locale, "viae.tools.removeSecond")}</button>}</div>}{activeGroup.type === "group" && <div className="flex flex-wrap gap-2">{eligibleManage.map(c => <button key={c.id} type="button" disabled={isLoading} onClick={() => { const included = activeGroup.members.includes(c.id); if (included && activeGroup.members.length <= 2) { notify(deepText(locale, "viae.tools.minTwo")); return; } updateGroup(activeGroup.id, g => ({ ...g, members: included ? g.members.filter(id => id !== c.id) : [...g.members, c.id], updatedAt: Date.now() })); }} className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${activeGroup.members.includes(c.id) ? "border-[#baa573] bg-[#fffaf0] text-[#695836]" : "border-[#e4e9ee] text-[#748395]"}`}>{c.avatar} {characterDisplayName(c.id, c.name, locale)}</button>)}</div>}</div>}
            <section className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-8" aria-label={deepText(locale, "viae.ui.conversationAria")}>
              <div className="flex items-center gap-3 text-[10px] text-[#9eabb7]"><div className="h-px flex-1 bg-[#e6e9eb]"/><Sparkles size={13} color={GOLD}/> WAYPOINT · {deepText(locale, "viae.currentMoment")} <div className="h-px flex-1 bg-[#e6e9eb]"/></div>
              {isObserving && <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 rounded-xl border border-[#e7ddcb] bg-[#fffdf8] px-4 py-2 text-[11px] text-[#806944]"><Compass size={14}/><span>{deepText(locale, "viae.observingPrefix")} <strong>{viewChar?.name || deepText(locale, "common.character")}</strong> {deepText(locale, "viae.observingSuffix")}</span></div>}
              {activeGroup.messages.length === 0 && <div className="mx-auto max-w-md py-16 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f1f4f6]"><PathEmblem size={42}/></div><h3 className="font-serif text-lg text-[#2a3d58]">{activeGroup.name}</h3><p className="mt-3 text-xs leading-7 text-[#8996a5]">{activeGroup.type === "direct" ? `${deepText(locale, "viae.joinDirect")} · ${who(activeGroup.members[0])?.name || deepText(locale, "common.character")}` : deepText(locale, "viae.actions.noHistory")}<br/>{deepText(locale, "viae.actions.pathMemory")}</p></div>}
              {activeGroup.messages.map((message, index) => {
                const isUser = message.role === "user";
                const isDirection = isUser && (message.kind === "director" || (isObserving && !message.kind));
                const text = asText(message.content);
                const partial = !isUser && isLoading && index === activeGroup.messages.length - 1 && !/<\/(?:viae_chat|lime_chat)>/i.test(text);
                const segments = isUser ? [{ charId: "", text }] : partial ? [{ charId: "", text: deepText(locale, "viae.actions.loading") }] : parseSpeakers(text);
                return <div key={message.id || index} className={`group flex flex-col gap-2 ${isDirection ? "items-center" : isUser ? "items-end" : "items-start"}`}>
                  {isDirection ? <div className="max-w-[94%] rounded-xl border border-[#e9dfcb] bg-[#fffdf8] px-5 py-3 text-center shadow-[0_2px_12px_rgba(172,140,88,0.05)] sm:max-w-[80%]"><div className="mb-1 flex items-center justify-center gap-2 text-[10px] font-semibold tracking-widest text-[#aa8b50]"><Sparkles size={13}/> SCENE DIRECTION / {deepText(locale, "viae.actions.direction")} <span className="font-normal text-[#ac9d82]">{time(message.createdAt)}</span></div><p className="whitespace-pre-wrap break-words text-left text-[13px] leading-6 text-[#685a45]">{text}</p></div> : segments.map((part, i) => {
                    const char = who(part.charId);
                    const content = part.text.replace(/<\/?(?:viae_chat|lime_chat)>/gi, "");
                    const isPhoneOwner = isObserving && !isUser && part.charId === (viewChar?.id || activeGroup.members[0]);
                    const isOutgoing = isUser || isPhoneOwner;
                    return <div key={i} className={`flex max-w-[94%] items-end gap-2 sm:max-w-[80%] ${isOutgoing ? "flex-row-reverse" : "flex-row"} ${isPhoneOwner ? "self-end" : ""}`}>
                      {!isUser && !isPhoneOwner && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e1e7ea] bg-white text-lg">{char?.avatar || "✦"}</span>}
                      <div className="min-w-0"><div className={`mb-1 flex items-center gap-2 text-[10px] text-[#93a0ac] ${isOutgoing ? "justify-end" : ""}`}>
                        <span>{isUser ? deepText(locale, "common.you") : char?.name || (partial ? deepText(locale, "viae.actions.loading") : "Viae")}</span>
                        <span>{time(message.createdAt)}</span>
                        {/* AI/character-bubble editing intentionally paused:
                            a future implementation must reconcile subsequent replies and STM/LTM. */}
                      </div><div className={`prose prose-sm max-w-none break-words rounded-2xl border px-4 py-3 text-[13px] leading-6 shadow-[0_3px_12px_rgba(24,42,63,0.03)] ${isOutgoing ? "prose-invert border-[#1b324f] bg-[#1a314f] text-white" : "border-[#e8ecef] bg-white text-[#2b4058]"}`}>{isUser ? content : <ReactMarkdown>{content || (partial ? deepText(locale, "viae.actions.loading") : "")}</ReactMarkdown>}</div></div>
                    </div>;
                  })}
                  {isUser && editingBubble?.id === message.id && editingBubble.index === index && (
                    <div role="group" aria-label={`VIAE · ${deepText(locale, "viae.actions.edit")}`} className="w-full max-w-[94%] space-y-2 rounded-xl border border-[#cbd6e7] bg-[#f6f8fc] p-3 shadow-sm sm:max-w-[80%]">
                      <p className="text-[10px] font-semibold tracking-wider text-[#62799a]">
                        {deepText(locale, "viae.actions.edit")} · {isDirection ? deepText(locale, "viae.actions.direction") : deepText(locale, "common.you")}
                      </p>
                      <textarea autoFocus rows={3} maxLength={5000} disabled={isLoading}
                        value={editingBubble.draft} onChange={event => setEditingBubble(prev => prev ? { ...prev, draft: event.target.value } : prev)}
                        className="w-full resize-y rounded-lg border border-[#cbd6e4] bg-white px-3 py-2 text-sm text-[#203751] outline-none focus:border-[#9eaccc]"/>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingBubble(null)}
                          className="rounded-lg border border-[#d8e0eb] bg-white px-3 py-1.5 text-xs text-[#6c7d91]">{deepText(locale, "common.cancel")}</button>
                        <button type="button" disabled={isLoading || !editingBubble.draft.trim()}
                          onClick={() => void confirmBubbleEdit()}
                          className="rounded-lg bg-[#637ba5] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{deepText(locale, "viae.actions.saveEdit")}</button>
                      </div>
                    </div>
                  )}
                  {!isUser && message.needsRegeneration && (
                    <div role="status" className="ml-0 flex max-w-xl items-center gap-2 rounded-xl border border-[#dfcfb0] bg-[#fffbf2] px-3 py-2 text-[11px] text-[#806943] sm:ml-11">
                      <AlertTriangle size={14} className="shrink-0"/>
                      <span>{deepText(locale, "viae.actions.stale")}</span>
                    </div>
                  )}
                  {!isUser && message.metadataRepairMissing && index === activeGroup.messages.length - 1 && (
                    <div role="status" className="ml-0 flex max-w-xl items-center gap-3 rounded-xl border border-[#d8c49d] bg-[#fffaef] px-3 py-2.5 text-xs text-[#796039] sm:ml-11">
                      <AlertTriangle size={15} className="shrink-0"/>
                      <span className="flex-1">{deepText(locale, "viae.actions.incomplete")}</span>
                      <button type="button" disabled={isLoading} onClick={() => void repairMessage(index)}
                        className="rounded-lg border border-[#d8c49d] bg-white px-3 py-1.5 font-semibold disabled:opacity-40">{isLoading ? deepText(locale, "viae.actions.repairing") : deepText(locale, "viae.actions.repair")}</button>
                    </div>
                  )}
                  <div className={`flex items-center gap-3 text-[#9ca7b5] opacity-70 transition group-hover:opacity-100 ${isDirection ? "justify-center" : isUser ? "pr-1" : "pl-11"}`}>
                    {/* TTS is paused while provider adapters are being redesigned. */}
                    {!isUser && !isLoading && index === activeGroup.messages.length - 1 && <button type="button" onClick={() => void confirmRefresh()} title={deepText(locale, "common.retry")} aria-label={deepText(locale, "common.retry")}><RotateCcw size={14}/></button>}
                    {isUser && !isLoading && <button type="button" onClick={() => startBubbleEdit(message.id, index, text)}
                      title={deepText(locale, "viae.actions.edit")} aria-label={deepText(locale, "viae.actions.editOwn")}><Pencil size={14}/></button>}
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(text); setCopyIndex(index); }} title={deepText(locale, "common.copy")} aria-label={deepText(locale, "common.copy")}>{copyIndex === index ? <Check size={14}/> : <Copy size={14}/>}</button>
                    {!isLoading && <button type="button" onClick={async () => { if (await dialog.confirm(deepText(locale, "viae.deleteMessage"))) deleteMessage(index); }} title={deepText(locale, "common.delete")} aria-label={deepText(locale, "common.delete")}><Trash2 size={14}/></button>}
                  </div>
                </div>;
              })}
              <div ref={bottom}/>
            </section>
            <form onSubmit={e => { e.preventDefault(); void send(); }} className="border-t border-[#e9ecef] bg-white px-4 py-4 sm:px-7"><div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[#e1e7eb] bg-[#fdfdfc] px-3 py-2 transition focus-within:border-[#bba573] focus-within:shadow-[0_0_0_3px_rgba(187,165,115,0.09)]"><textarea disabled={isLoading} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={2} placeholder={deepText(locale, isObserving ? "viae.observeInput" : activeGroup.type === "direct" ? "viae.directInput" : "viae.groupInput")} className="min-h-11 max-h-36 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#243850] outline-none placeholder:text-[#a1adb7]"/><button type={isLoading ? "button" : "submit"} disabled={!isLoading && (!input.trim() || !providerConfigured)} onClick={isLoading ? () => void confirmStopGeneration() : undefined} aria-label={deepText(locale, isLoading ? "common.stop" : "common.send")} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40 ${isLoading ? "bg-rose-500" : "bg-[#172d49] hover:bg-[#274461]"}`}>{isLoading ? <Square size={17}/> : <Send size={17}/>}</button></div><p className="mx-auto mt-2 max-w-3xl truncate text-[10px] text-[#9aa6b1]">{providerConfigured ? `${providers.find(p => p.id === provider)?.label || provider} · ${customModel.trim() || model}` : deepText(locale, "viae.noProvider")} · {isObserving ? deepText(locale, "viae.actions.observerHint") : deepText(locale, "viae.actions.participantHint")} · {deepText(locale, "viae.actions.lineBreak")}</p></form>
            <MemoryVaultModal open={openMemory} onClose={() => setOpenMemory(false)} sessionId={`${session.id}:${activeGroup.id}`} stm={activeGroup.stm} ltm={activeGroup.ltm} tone="viae" onSave={({ stm, ltm }) => { updateGroup(activeGroup.id, g => ({ ...g, stm, ltm, turnCount: stm.split(/\n/).filter(Boolean).length, updatedAt: Date.now() })); notify(deepText(locale, "viae.ui.memorySaved")); }}/>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center text-[#8b9ba9]">
            <div className="relative mb-8 w-full max-w-lg overflow-hidden rounded-2xl border border-[#e6e1d7] bg-[#fffefa] py-12 shadow-[0_16px_50px_rgba(31,45,59,0.035)]"><RouteIllustration/><div className="absolute right-6 top-0 h-12 w-5 bg-[#d1b680]/55" style={{clipPath:"polygon(0 0,100% 0,100% 100%,50% 75%,0 100%)"}} aria-hidden="true"/><div className="relative flex justify-center"><PathEmblem size={76}/></div></div>
            <p className="text-[10px] font-semibold tracking-[0.24em] text-[#b39762]">SHIORIVIA · VIAE</p>
            <h2 className="mt-3 font-serif text-2xl text-[#344d67]">{deepText(locale, "viae.ui.hero")}</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-[#8697a6]">{conversations.length ? deepText(locale, "viae.actionMessageArchive") : deepText(locale, "viae.actionMessageStart")}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3"><button onClick={() => resetCreate("direct")} className="rounded-xl border border-[#ded1b8] bg-white px-5 py-2.5 text-xs font-semibold text-[#836d47] hover:bg-[#fff8e9]">+ {deepText(locale, "viae.kindDirect")}</button><button onClick={() => resetCreate("group")} className="rounded-xl bg-[#203852] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#35536c]">+ {deepText(locale, "viae.kindGroup")}</button></div>
          </div>
        )}
      </main>

      {/* Route information is a quiet contextual panel on desktop and a toggle on mobile. */}
      {activeGroup && <>
        {showDetails && <button type="button" onClick={() => setShowDetails(false)} title={deepText(locale, "viae.headerClose")} aria-label={deepText(locale, "viae.headerClose")} className="fixed inset-0 z-30 bg-[#152840]/30 xl:hidden"/>}
        <aside className={`z-40 min-h-0 w-[300px] shrink-0 flex-col overflow-y-auto border-l border-[#ebedef] bg-white px-5 py-6 xl:flex ${showDetails ? "fixed inset-y-0 right-0 flex w-[min(320px,90vw)] shadow-xl xl:static xl:shadow-none" : "hidden"}`}>
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.16em] text-[#8592a1]"><span>PATH DETAILS / {deepText(locale, "viae.headerDetails")}</span><button type="button" onClick={() => setShowDetails(false)} title={deepText(locale, "viae.headerClose")} aria-label={deepText(locale, "viae.headerClose")} className="xl:hidden"><X size={17}/></button></div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#e6e9eb]"><div className="relative h-20 bg-[#192e4b]"><RouteIllustration/></div><div className="p-4"><div className="flex items-center justify-between gap-2"><h3 className="truncate text-sm font-semibold">{activeGroup.name}</h3><button type="button" onClick={() => rename(activeGroup)} aria-label={deepText(locale, "common.rename")} title={deepText(locale, "common.rename")} className="text-[#8291a1] hover:text-[#2b4666]"><Pencil size={15}/></button></div><p className="mt-1 text-[11px] text-[#8695a5]">{kindName(activeGroup, locale)} · {activeGroup.members.length} {deepText(locale, "viae.memberCountUnit")}</p><div className="mt-3 flex flex-wrap gap-1">{activeGroup.members.map(id => <span key={id} title={who(id)?.name || id} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e8eb] bg-[#f8f8f6] text-base">{who(id)?.avatar || "✦"}</span>)}</div></div></div>
          <div className="mt-7"><p className="mb-3 text-[10px] font-semibold tracking-[0.15em] text-[#8592a1]">ROUTE / TIMELINE</p><button type="button" onClick={editRoute} className="flex w-full items-center gap-3 rounded-xl border border-[#e4e8eb] bg-[#fcfcfb] p-3 text-left transition hover:border-[#cbb58d]"><span className="rounded-lg bg-[#e9eef3] p-2 text-[#3b5371]"><Compass size={19}/></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{viaeWorldline(activeGroup).worldName}</span><span className="mt-0.5 block truncate text-[10px] text-[#8593a2]">{routeName(activeGroup)}</span></span><ChevronRight size={15} className="text-[#99a4af]"/></button></div>
          <div className="mt-7"><p className="mb-3 text-[10px] font-semibold tracking-[0.15em] text-[#8592a1]">{deepText(locale, "viae.tools.tools")}</p><div className="space-y-2"><button type="button" onClick={() => setOpenMemory(true)} className="flex w-full items-center gap-3 rounded-xl border border-[#e4e8eb] bg-white px-3 py-3 text-left transition hover:bg-[#f7f9fa]"><Brain size={18} className="text-[#49617c]"/><span className="flex-1 text-xs font-semibold">Memory Vault <span className="mt-0.5 block text-[10px] font-normal text-[#93a0ad]">{deepText(locale, "viae.tools.memoryHint")}</span></span><ChevronRight size={15} className="text-[#a6b0b9]"/></button><button type="button" onClick={() => { setShowManage(true); setShowDetails(false); }} className="flex w-full items-center gap-3 rounded-xl border border-[#e4e8eb] bg-white px-3 py-3 text-left transition hover:bg-[#f7f9fa]"><Users size={18} className="text-[#49617c]"/><span className="flex-1 text-xs font-semibold">{deepText(locale, "viae.manage")}</span><ChevronRight size={15} className="text-[#a6b0b9]"/></button><button type="button" onClick={() => { setShowModels(true); setShowDetails(false); }} className="flex w-full items-center gap-3 rounded-xl border border-[#e4e8eb] bg-white px-3 py-3 text-left transition hover:bg-[#f7f9fa]"><Settings2 size={18} className="text-[#49617c]"/><span className="flex-1 text-xs font-semibold">{deepText(locale, "viae.models")}</span><ChevronRight size={15} className="text-[#a6b0b9]"/></button></div></div>
          {isObserving && <div className="mt-7 rounded-xl border border-[#e9dfcb] bg-[#fffdf8] p-3"><p className="mb-2 text-[10px] font-semibold tracking-[0.15em] text-[#a18a62]">CURRENT VIEWPOINT / {deepText(locale, "viae.headerViewpoint")}</p><select disabled={isLoading} value={activeGroup.members.includes(activeGroup.defaultPovChar || "") ? activeGroup.defaultPovChar : activeGroup.members[0]} onChange={e => changeViewpoint(e.target.value)} aria-label={deepText(locale, "viae.headerViewpoint")} className="w-full rounded-lg border border-[#e3dccd] bg-white px-3 py-2 text-xs text-[#324961] outline-none">{activeGroup.members.map(id => <option key={id} value={id}>{who(id)?.name || id} · {deepText(locale, "viae.headerPhone")}</option>)}</select></div>}
          <div className="mt-7"><p className="mb-3 text-[10px] font-semibold tracking-[0.15em] text-[#8592a1]">TRAVELERS / {deepText(locale, "viae.headerTravelers")}</p><div className="space-y-3">{activeGroup.members.map(id => { const c = who(id); return <div key={id} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f4f5] text-lg">{c?.avatar || "✦"}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{c?.name || id}</span><span className="block truncate text-[10px] text-[#95a0aa]">{worldNameFor(memberOrigin(id))}</span></span></div>; })}</div></div>
          <div className="mt-auto pt-8 text-center"><div className="mx-auto mb-2 h-px w-16 bg-[#d8c59f]"/><p className="font-serif text-xs italic text-[#a18a63]">{deepText(locale, "viae.ui.footer")}</p></div>
        </aside>
      </>}
    </div>
  );
}
