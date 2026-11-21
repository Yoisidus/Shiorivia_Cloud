"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, ChatFolder } from "../types";
import { collectAppendDeltas, completedTurns } from "../lib/appendSync";
import type { LocalSyncPreferences } from "../lib/localSyncPreferences";
import { browserRead, browserWrite } from "../lib/browserStore";
import { useAppDialog } from "../context/DialogContext";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";

type SavedSessionState = {
  sessions: Session[];
  folders: ChatFolder[];
  globalWorldInfo: string;
  bgImage: string | null;
};
type StoredSessions = { data: SavedSessionState; lastModified: number };
const EMPTY: SavedSessionState = { sessions: [], folders: [], globalWorldInfo: "", bgImage: null };
const STORAGE_KEY = "sessions";

export const useLocalFileSync = (isGlobalGenerating: boolean, showToast: (msg: string) => void, preferences: LocalSyncPreferences) => {
  const dialog = useAppDialog();
  const { locale } = useLanguage();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [globalWorldInfo, setGlobalWorldInfo] = useState("");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "syncing" | "error" | "success" | "unsaved">("idle");
  const [initLoaded, setInitLoaded] = useState(false);
  const lastSnapshot = useRef(JSON.stringify(EMPTY));
  const lastModified = useRef(0);
  const saveInFlight = useRef(false);
  const dirty = useRef(false);
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean; cloudData: any; localData: any; reason: "conflict" | "mass_loss";
  }>({ isOpen: false, cloudData: null, localData: null, reason: "conflict" });

  const performSync = useCallback(async (mode: "auto" | "manual" | "force_push" | "force_pull") => {
    if (saveInFlight.current) return;
    if (mode === "auto" && (isGlobalGenerating || !preferences.autoSync)) return;
    saveInFlight.current = true;
    try {
      if (mode === "manual" && !await dialog.confirm(deepText(locale, "cloud.storage.saveConfirm"))) return;
      setStatus("syncing");
      const saved = await browserRead<StoredSessions | null>(STORAGE_KEY, null);
      const payload: SavedSessionState = { sessions, folders, globalWorldInfo, bgImage };
      const snapshot = JSON.stringify(payload);
      if (mode === "force_pull" || !initLoaded) {
        const data = saved?.data || EMPTY;
        setSessions(data.sessions || []);
        setFolders(data.folders || []);
        setGlobalWorldInfo(data.globalWorldInfo || "");
        setBgImage(data.bgImage || null);
        lastSnapshot.current = JSON.stringify({
          sessions: data.sessions || [], folders: data.folders || [],
          globalWorldInfo: data.globalWorldInfo || "", bgImage: data.bgImage || null,
        });
        lastModified.current = saved?.lastModified || 0;
        dirty.current = false;
        setInitLoaded(true);
        setStatus("idle");
        return;
      }
      if (mode !== "force_push" && saved && saved.lastModified > lastModified.current &&
          JSON.stringify(saved.data) !== lastSnapshot.current) {
        setConflictModal({
          isOpen: true, cloudData: { ...saved.data, _ts: saved.lastModified },
          localData: { ...payload, _ts: Date.now() }, reason: "conflict",
        });
        setStatus("unsaved");
        return;
      }
      if (mode === "auto") {
        const previous = JSON.parse(lastSnapshot.current) as SavedSessionState;
        const delta = collectAppendDeltas(sessions, previous.sessions || []);
        if (completedTurns(delta) < preferences.autoSyncInterval) { setStatus("unsaved"); return; }
        // Save the whole browser snapshot, never append blindly across unrelated sessions.
        // Auto-save must not overwrite deletion/edit-only changes.
        const changedOutsideAppend = folders !== undefined && JSON.stringify(folders) !== JSON.stringify(previous.folders || []) ||
          globalWorldInfo !== (previous.globalWorldInfo || "") || bgImage !== (previous.bgImage || null);
        if (changedOutsideAppend) { setStatus("unsaved"); return; }
      }
      if (mode === "manual" && snapshot === lastSnapshot.current) {
        dialog.notify(deepText(locale, "cloud.storage.alreadySaved"));
        setStatus("idle"); return;
      }
      if (mode === "manual" && (saved?.data.sessions || []).reduce((n,s)=>n+(s.messages?.length || 0),0) >= 10 &&
          sessions.reduce((n,s)=>n+(s.messages?.length || 0),0) < (saved?.data.sessions || []).reduce((n,s)=>n+(s.messages?.length || 0),0) / 2) {
        setConflictModal({
          isOpen: true, cloudData: { ...saved?.data, _ts: saved?.lastModified },
          localData: { ...payload, _ts: Date.now() }, reason: "mass_loss",
        });
        setStatus("unsaved"); return;
      }
      const stamp = Date.now();
      await browserWrite(STORAGE_KEY, { data: payload, lastModified: stamp });
      lastModified.current = stamp;
      lastSnapshot.current = snapshot;
      dirty.current = false;
      setStatus("success");
      if (mode === "manual") dialog.notify(deepText(locale, "cloud.storage.saved"));
    } catch (e) {
      console.error("[Cloud browser storage]", e);
      setStatus("error");
      if (mode === "manual") dialog.notify(deepText(locale, "cloud.storage.failed"));
    } finally {
      saveInFlight.current = false;
    }
  }, [sessions, folders, globalWorldInfo, bgImage, initLoaded, preferences.autoSync,
    preferences.autoSyncInterval, isGlobalGenerating, dialog, locale]);

  useEffect(() => { void performSync("force_pull"); }, []);
  useEffect(() => {
    if (!initLoaded) return;
    dirty.current = JSON.stringify({ sessions, folders, globalWorldInfo, bgImage }) !== lastSnapshot.current;
    if (!dirty.current) { setStatus(s => s === "syncing" ? s : "idle"); return; }
    setStatus(s => s === "syncing" ? s : "unsaved");
    if (!preferences.autoSync || isGlobalGenerating) return;
    const timer = setTimeout(() => { void performSync("auto"); }, 2500);
    return () => clearTimeout(timer);
  }, [initLoaded, sessions, folders, globalWorldInfo, bgImage,
    preferences.autoSync, preferences.autoSyncInterval, isGlobalGenerating]);

  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current || status === "syncing") { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [status]);

  return { sessions, setSessions, folders, setFolders, globalWorldInfo, setGlobalWorldInfo,
    bgImage, setBgImage, status, conflictModal, setConflictModal,
    initLoaded, triggerSync: performSync };
};
