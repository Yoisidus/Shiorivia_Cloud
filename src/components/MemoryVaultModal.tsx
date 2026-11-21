"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Brain, Check, LockKeyhole, Plus, Save, Trash2, X } from "lucide-react";
import { formatLocalMemoryEntries, latestLocalMemoryEntry, LOCAL_STM_SLOTS, parseLocalMemoryEntries } from "../lib/localMemory";
import { useLanguage } from "../context/LanguageContext";
import { localText } from "../lib/i18nLocal";
import { deepText } from "../lib/i18nDeep";
import { useAppDialog } from "../context/DialogContext";

export type MemoryTone = "engineering" | "story" | "chat" | "viae" | "novel" | "novel-sage" | "novel-paper";

type MemoryDraft = { stm: string; ltm: string };

type MemoryVaultProps = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  stm?: string;
  ltm?: string;
  onSave: (next: MemoryDraft) => void;
  tone?: MemoryTone;
};

const tones = {
  engineering: { accent: "text-[#3b719c]", border: "border-[#c5dcf0]", tag: "bg-[#e6f2ff]", button: "bg-[#4788bc] hover:bg-[#306f9f]", frame: "bg-[#f6fbff]", header: "bg-[#eaf5ff]", panel: "bg-[#edf7ff]", label: "OFFICINA · MEMORY WORKSPACE" },
  story: { accent: "text-[#ab5d88]", border: "border-[#edcbdc]", tag: "bg-[#ffedf6]", button: "bg-[#b96792] hover:bg-[#9e4e78]", frame: "bg-[#fff8fc]", header: "bg-[#ffedf5]", panel: "bg-[#fff0f7]", label: "VIA LATA · STORY ARCHIVE" },
  chat: { accent: "text-[#478469]", border: "border-[#c6e2d1]", tag: "bg-[#e6f6ed]", button: "bg-[#529274] hover:bg-[#41775f]", frame: "bg-[#f6fcf8]", header: "bg-[#ebf8f0]", panel: "bg-[#effbf4]", label: "UMBRA · CHARACTER MEMORIES" },
  viae: { accent: "text-[#607997]", border: "border-[#ccd7e7]", tag: "bg-[#eaf0f8]", button: "bg-[#5d779a] hover:bg-[#435d80]", frame: "bg-[#f7f9fe]", header: "bg-[#eaf0fa]", panel: "bg-[#edf3fc]", label: "VIAE · PATH ARCHIVE" },
  novel: { accent: "text-[#806344]", border: "border-[#e0caa4]", tag: "bg-[#f9eed8]", button: "bg-[#94704b] hover:bg-[#765638]", frame: "bg-[#fdf6e3]", header: "bg-[#f6e7c9]", panel: "bg-[#fff8ea]", label: "TELA · CHAPTER ARCHIVE" },
};

export function MemoryPreviewButton({ stm, ltm, onOpen, tone = "story" }: {
  stm?: string;
  ltm?: string;
  onOpen: () => void;
  tone?: MemoryTone;
}) {
  const { locale } = useLanguage();
  const style = tones[tone === "novel-sage" ? "story" : tone === "novel-paper" ? "novel" : tone];
  const stmCount = parseLocalMemoryEntries(stm).length;
  const ltmCount = parseLocalMemoryEntries(ltm).length;
  const latestStm = latestLocalMemoryEntry(stm);
  const latestLtm = latestLocalMemoryEntry(ltm);

  return (
    <button type="button" onClick={onOpen} className={`w-full rounded-xl border ${style.border} ${style.frame} p-3 text-left shadow-[0_5px_20px_rgba(42,56,72,.05)] transition hover:brightness-[.985]`} aria-label={localText(locale, "memory.open")}>
      <div className={`mb-3 flex items-center justify-between gap-2 text-xs font-bold ${style.accent}`}>
        <span className="flex items-center gap-2"><Brain size={15} /> {style.label} / {deepText(locale, "memory.ui.title")}</span>
        <span className={`rounded-md px-2 py-1 text-[10px] ${style.tag}`}>{deepText(locale, "memory.ui.open")}</span>
      </div>
      <div className="space-y-2 text-[11px] leading-5 text-slate-600">
        <div className={`rounded-lg ${style.panel} p-2`}><span className="font-semibold text-slate-400">STM · {stmCount}</span><p className="mt-0.5 line-clamp-2 break-words">{latestStm || localText(locale, "memory.emptyStm")}</p></div>
        <div className={`rounded-lg ${style.panel} p-2`}><span className="font-semibold text-slate-400">LTM · {ltmCount}</span><p className="mt-0.5 line-clamp-2 break-words">{latestLtm || localText(locale, "memory.emptyLtm")}</p></div>
      </div>
    </button>
  );
}

export function MemoryVaultModal({ open, onClose, sessionId, stm = "", ltm = "", onSave, tone = "engineering" }: MemoryVaultProps) {
  const { locale } = useLanguage();
  const dialog = useAppDialog();
  const style = tones[tone === "novel-sage" ? "story" : tone === "novel-paper" ? "novel" : tone];
  const [stmSlots, setStmSlots] = useState<string[]>([]);
  const [ltmSlots, setLtmSlots] = useState<string[]>([]);
  const [error, setError] = useState("");
  const original = useRef<MemoryDraft>({ stm: "", ltm: "" });

  useEffect(() => {
    if (!open) return;
    original.current = { stm, ltm };
    setStmSlots(parseLocalMemoryEntries(stm));
    setLtmSlots(parseLocalMemoryEntries(ltm));
    setError("");
    // Take a snapshot on opening or switching the session; don't discard an in-progress
    // edit if the chat engine updates memory while this window is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const visibleStmCount = Math.max(LOCAL_STM_SLOTS, stmSlots.length);
  const filledStm = stmSlots.filter((entry) => entry.trim()).length;

  const save = async () => {
    if (stm !== original.current.stm || ltm !== original.current.ltm) {
      setError(localText(locale, "memory.changed"));
      return;
    }
    if (!await dialog.confirm(localText(locale, "memory.confirm"))) return;
    onSave({ stm: formatLocalMemoryEntries(stmSlots), ltm: formatLocalMemoryEntries(ltmSlots) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-2 backdrop-blur-sm sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={deepText(locale, "memory.ui.title")} className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border ${style.border} ${style.frame} text-slate-700 shadow-2xl sm:max-h-[calc(100dvh-3rem)]`}>
        <header className={`flex shrink-0 items-start justify-between gap-3 border-b ${style.border} ${style.header} px-4 py-4 sm:px-6`}>
          <div>
            <p className={`mb-1 text-[10px] font-bold uppercase tracking-[0.2em] ${style.accent}`}>{style.label}</p>
            <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl"><Brain size={21} className={style.accent} /> {deepText(locale, "memory.ui.title")}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{localText(locale, "memory.description")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={localText(locale, "memory.close")} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div className={`rounded-xl border ${style.border} ${style.panel} p-3`}>
              <div className={`mb-1 flex items-center gap-1.5 text-xs font-bold ${style.accent}`}><Brain size={14} /> {deepText(locale, "memory.ui.latest")} STM</div>
              <p className="line-clamp-3 min-h-10 break-words text-xs leading-6 text-slate-600">{latestLocalMemoryEntry(stm) || localText(locale, "memory.emptyStm")}</p>
            </div>
            <div className={`rounded-xl border ${style.border} ${style.panel} p-3`}>
              <div className={`mb-1 flex items-center gap-1.5 text-xs font-bold ${style.accent}`}><Archive size={14} /> {deepText(locale, "memory.ui.latest")} LTM</div>
              <p className="line-clamp-3 min-h-10 break-words text-xs leading-6 text-slate-600">{latestLocalMemoryEntry(ltm) || localText(locale, "memory.emptyLtm")}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className={`flex items-center gap-2 text-sm font-bold ${style.accent}`}><Brain size={16} /> STM · {localText(locale, "memory.stm")}</h3>
                <span className={`rounded-md px-2 py-1 text-[10px] ${style.tag}`}>{deepText(locale, "memory.ui.filledSlots").replace("{filled}", String(filledStm)).replace("{slots}", String(LOCAL_STM_SLOTS))}</span>
              </div>
              {visibleStmCount > LOCAL_STM_SLOTS && <p className="mb-3 text-xs leading-5 text-amber-700">{deepText(locale, "memory.ui.legacyWarning").replace("{count}", String(visibleStmCount))}</p>}
              <div className="space-y-3">
                {Array.from({ length: visibleStmCount }, (_, index) => (
                  <div key={index} className={`rounded-xl border ${style.border} bg-white/85 p-3`}>
                    <label htmlFor={`shiorivia-stm-${index}`} className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">STM {index + 1}</span>
                      {index >= LOCAL_STM_SLOTS && <span className="text-amber-700">{deepText(locale, "memory.ui.legacyRetained")}</span>}
                    </label>
                    <textarea id={`shiorivia-stm-${index}`} rows={3} value={stmSlots[index] || ""}
                      onChange={(e) => setStmSlots((prev) => Array.from({ length: Math.max(index + 1, prev.length) }, (_, i) => i === index ? e.target.value : prev[i] || ""))}
                      placeholder={deepText(locale, "memory.ui.stmPlaceholder")}
                      className={`w-full resize-y rounded-lg border ${style.border} bg-white/85 p-2 text-xs leading-6 outline-none focus:ring-1 focus:ring-current ${style.accent}`} />
                  </div>
                ))}
              </div>
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className={`flex items-center gap-2 text-sm font-bold ${style.accent}`}><Archive size={16} /> LTM · {localText(locale, "memory.ltm")}</h3>
                <button type="button" onClick={() => setLtmSlots((prev) => [...prev, ""])} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${style.button}`}><Plus size={14} /> {localText(locale, "memory.add")}</button>
              </div>
              <div className="space-y-3">
                {ltmSlots.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">{localText(locale, "memory.emptyList")}</div>}
                {ltmSlots.map((entry, index) => (
                  <div key={index} className={`rounded-xl border ${style.border} bg-white/85 p-3`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label htmlFor={`shiorivia-ltm-${index}`} className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">LTM {index + 1}</label>
                      <button type="button" aria-label={`${deepText(locale, "memory.ui.removeLtm")} ${index + 1}`} onClick={async () => { if (await dialog.confirm(deepText(locale, "memory.ui.removeLtmConfirm").replace("{index}", String(index + 1)))) setLtmSlots((prev) => prev.filter((_, i) => i !== index)); }} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                    <textarea id={`shiorivia-ltm-${index}`} rows={3} value={entry}
                      onChange={(e) => setLtmSlots((prev) => prev.map((item, i) => i === index ? e.target.value : item))}
                      placeholder={deepText(locale, "memory.ui.ltmPlaceholder")}
                      className={`w-full resize-y rounded-lg border ${style.border} bg-white/85 p-2 text-xs leading-6 outline-none focus:ring-1 focus:ring-current ${style.accent}`} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <footer className={`flex shrink-0 flex-col gap-3 border-t ${style.border} ${style.header} px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6`}>
          <div className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><LockKeyhole size={15} className="mt-0.5 shrink-0" /> {deepText(locale, "memory.ui.storageHelp")}</div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">{localText(locale, "memory.cancel")}</button>
            <button type="button" onClick={save} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white ${style.button}`}><Save size={15} /> {localText(locale, "memory.save")} <Check size={13} /></button>
          </div>
          {error && <p role="alert" className="text-xs text-red-600 sm:basis-full">{error}</p>}
        </footer>
      </div>
    </div>
  );
}
