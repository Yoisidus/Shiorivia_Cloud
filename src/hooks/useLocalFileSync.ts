import { useState, useEffect, useRef, useCallback } from "react";
import { Session, ChatFolder } from "../types";
import { collectAppendDeltas, completedTurns } from "../lib/appendSync";
import type { LocalSyncPreferences } from "../lib/localSyncPreferences";
import { useAppDialog } from "../context/DialogContext";

export const useLocalFileSync = (isGlobalGenerating: boolean, showToast: (msg: string) => void, preferences: LocalSyncPreferences) => {
    const dialog = useAppDialog();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [folders, setFolders] = useState<ChatFolder[]>([]);
    const [globalWorldInfo, setGlobalWorldInfo] = useState("");
    const [bgImage, setBgImage] = useState<string | null>(null);
    
    const [status, setStatus] = useState<'idle'|'syncing'|'error'|'success'|'unsaved'>('idle');
    const [initLoaded, setInitLoaded] = useState(false);
    const [lastServerTime, setLastServerTime] = useState(0);

    const lastSavedMsgCount = useRef(0);
    const hasUnsavedChanges = useRef(false);
    // Hold the manual-save lock across confirmation and disk I/O.
    const manualSyncInFlight = useRef(false);

    const [conflictModal, setConflictModal] = useState<{
        isOpen: boolean; cloudData: any; localData: any; reason: 'conflict'|'mass_loss';
    }>({ isOpen: false, cloudData: null, localData: null, reason: 'conflict' });

    // String length is not a hash: equal-sized edits were silently skipped.
    const serialize = (d: unknown) => JSON.stringify(d);
    const lastSnapshot = useRef("");

    const countTotalMessages = (sess: Session[]) => sess.reduce((acc, s) => acc + (s.messages ? s.messages.length : 0), 0);

    const performSync = useCallback(async (mode: 'auto' | 'manual' | 'force_push' | 'force_pull') => {
        console.log(`[Sync] Triggered. Mode: ${mode}`); 
        if (mode === "manual") {
            if (manualSyncInFlight.current) return;
            manualSyncInFlight.current = true;
        }
        try {

        if (mode === 'auto' && (isGlobalGenerating || !preferences.autoSync)) return;

        // A smaller message count is normal after deletions, regeneration or slot loads.
        // Severe losses are checked against the last saved snapshot below, not blocked forever.

        if (mode === 'manual') {
            if (!await dialog.confirm("💾 确定要将当前状态写入硬盘吗？\n(覆盖存档)")) {
                console.log(`[Sync] User cancelled.`);
                return;
            }
        }

        setStatus('syncing');

        try {
            const localPayload = { sessions, folders, globalWorldInfo, bgImage };
            const currentSnapshot = serialize(localPayload);

            const res = await fetch("/api/local/sync", { cache: "no-store" });
            if (!res.ok) throw new Error(`Local sync read failed: ${res.status}`);
            const { data: serverData, lastModified } = await res.json();
            const serverSnapshot = serverData ? serialize({
                sessions: serverData.sessions || [], folders: serverData.folders || [],
                globalWorldInfo: serverData.globalWorldInfo || "", bgImage: serverData.bgImage || null,
            }) : serialize({ sessions: [], folders: [], globalWorldInfo: "", bgImage: null });

            if (mode === 'force_pull' || !initLoaded) {
                console.log(`[Sync] Force Pull Executing...`);
                if (serverData) {
                    setSessions(serverData.sessions || []);
                    setFolders(serverData.folders || []);
                    setGlobalWorldInfo(serverData.globalWorldInfo || "");
                    setBgImage(serverData.bgImage || null);
                    
                    setLastServerTime(lastModified);
                    lastSnapshot.current = serverSnapshot;
                    lastSavedMsgCount.current = countTotalMessages(serverData.sessions || []);
                    hasUnsavedChanges.current = false;
                } else {
                    // A fresh Local installation has an empty, already-synced
                    // in-memory payload. No disk write is needed on first open.
                    lastSnapshot.current = serialize({ sessions: [], folders: [], globalWorldInfo: "", bgImage: null });
                    hasUnsavedChanges.current = false;
                }
                setInitLoaded(true);
                setStatus('idle');
                return;
            }

            if (mode !== 'force_push' && lastModified > lastServerTime && serverSnapshot !== lastSnapshot.current) {
                console.warn(`[Sync] Conflict Detected!`);
                if (mode === 'manual') {
                    setConflictModal({
                        isOpen: true,
                        cloudData: { ...serverData, _ts: lastModified },
                        localData: { ...localPayload, _ts: Date.now() },
                        reason: 'conflict'
                    });
                } else {
                    setStatus('error');
                }
                return;
            }

            if (mode === 'auto') {
                // Compare only appendable, completed messages against the last disk snapshot.
                // Character metadata, edits and deletions NEVER write automatically.
                const saved = lastSnapshot.current ? JSON.parse(lastSnapshot.current) : null;
                const deltas = saved ? collectAppendDeltas(sessions, saved.sessions || []) : [];
                if (completedTurns(deltas) < preferences.autoSyncInterval) { setStatus('unsaved'); return; }
                const append = await fetch('/api/local/sync/append', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deltas }) });
                if (!append.ok) { setStatus('unsaved'); return; }
                const result = await append.json();
                lastSnapshot.current = serialize(result.data);
                setLastServerTime(result.lastModified);
                setStatus(currentSnapshot === lastSnapshot.current ? 'success' : 'unsaved');
                return;
            }

            const currentCount = countTotalMessages(sessions);
            const diskCount = countTotalMessages(serverData?.sessions || []);
            const missingMostMessages = diskCount >= 10 && currentCount < diskCount * 0.5;
            if (mode === 'auto' && missingMostMessages) {
                // A drastic shrink needs an explicit manual decision; never autosave over it.
                hasUnsavedChanges.current = true;
                setStatus('unsaved');
                return;
            }
            if (mode === 'manual' && missingMostMessages) {
                    setConflictModal({
                        isOpen: true,
                        cloudData: { ...serverData, _ts: lastModified },
                        localData: { ...localPayload, _ts: Date.now() },
                        reason: 'mass_loss'
                    });
                    setStatus('unsaved');
                    return;
            }

            const hasChanges = currentSnapshot !== lastSnapshot.current;
            
            if (mode === 'manual' && !hasChanges) {
                console.log(`[Sync] Manual check - No changes.`);
                dialog.notify("当前内容已保存到本地，无需重复写入。");
                hasUnsavedChanges.current = false; 
                lastSavedMsgCount.current = countTotalMessages(sessions); 
                setStatus('idle');
                return; 
            }

            if (hasChanges || mode === 'force_push' || mode === 'manual') {
                console.log(`[Sync] Pushing to disk...`);
                const saveRes = await fetch("/api/local/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ data: localPayload })
                });
                
                if (saveRes.ok) {
                    const json = await saveRes.json();
                    setLastServerTime(json.lastModified);
                    lastSnapshot.current = currentSnapshot;
                    lastSavedMsgCount.current = countTotalMessages(sessions);
                    hasUnsavedChanges.current = false;

                    setStatus('success');
                    if (mode === 'manual') dialog.notify("保存成功 · 已写入本地磁盘。");
                    setTimeout(() => setStatus('idle'), 2000);
                } else {
                    console.error(`[Sync] Save Failed: ${saveRes.status}`);
                    setStatus('error');
                    if (mode === "manual") dialog.notify("保存失败，请检查本地服务和磁盘状态。");
                }
            } else {
                setStatus('idle');
            }

        } catch (e) {
            console.error("[Sync] CRITICAL ERROR:", e);
            setStatus('error');
            if (mode === "manual") dialog.notify("保存失败，请检查本地服务和磁盘状态。");
        }
        } finally {
            if (mode === "manual") manualSyncInFlight.current = false;
        }
    }, [sessions, folders, globalWorldInfo, bgImage, initLoaded, lastServerTime, preferences.autoSync, preferences.autoSyncInterval, isGlobalGenerating, dialog]);

    useEffect(() => {
        if (!initLoaded) return;
        const snapshot = serialize({ sessions, folders, globalWorldInfo, bgImage });
        // Hydration, toggling auto-sync and generation state are not edits.
        // Compare persisted content; never mark an unchanged startup as dirty.
        const unsaved = snapshot !== lastSnapshot.current;
        hasUnsavedChanges.current = unsaved;
        if (!unsaved) {
            setStatus(current => current === 'syncing' ? current : 'idle');
            return;
        }
        setStatus(current => current === 'syncing' ? current : 'unsaved');
        if (!preferences.autoSync || isGlobalGenerating) return;
        const timer = setTimeout(() => { void performSync('auto'); }, 2500);
        return () => clearTimeout(timer);
    }, [initLoaded, sessions, folders, globalWorldInfo, bgImage, preferences.autoSync, preferences.autoSyncInterval, isGlobalGenerating]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges.current || status === 'syncing') {
                e.preventDefault(); e.returnValue = ''; return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [status]);

    useEffect(() => { performSync('force_pull'); }, []);

    return {
        sessions, setSessions, folders, setFolders,
        globalWorldInfo, setGlobalWorldInfo, bgImage, setBgImage,
        status, conflictModal, setConflictModal, initLoaded,
        triggerSync: performSync
    };
};