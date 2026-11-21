"use client";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useAppDialog } from "../context/DialogContext";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";
import { BookOpen, X, Edit2, Save } from "lucide-react";

type WorldInfoModalProps = {
   isOpen: boolean;
   onClose: () => void;
   title: string;
   subtitle?: string;
   content: string;
   onSave: (content: string) => void;
   tone?: "story" | "chat" | "engineering";
};

/** Draft-first editor: closing without Save never mutates the session. */
export const WorldInfoModal = ({ isOpen, onClose, title, subtitle, content, onSave, tone = "chat" }: WorldInfoModalProps) => {
   const dialog = useAppDialog();
   const { locale } = useLanguage();
   const [draft, setDraft] = useState(content);
   useEffect(() => { if (isOpen) setDraft(content); }, [isOpen, content]);
   const accent = tone === "story"
      ? { border: "border-fuchsia-200", background: "bg-fuchsia-50", text: "text-fuchsia-800", button: "bg-fuchsia-600 hover:bg-fuchsia-700", focus: "focus:ring-fuchsia-300" }
      : tone === "engineering"
      ? { border: "border-sky-200", background: "bg-sky-50", text: "text-sky-800", button: "bg-sky-700 hover:bg-sky-800", focus: "focus:ring-sky-300" }
      : { border: "border-emerald-200", background: "bg-emerald-50", text: "text-emerald-800", button: "bg-emerald-600 hover:bg-emerald-700", focus: "focus:ring-emerald-300" };
   const save = () => {
      onSave(draft);
      dialog.notify(deepText(locale, "modal.notesSaved"), { type: "success" });
      onClose();
   };
   return (
      <AnimatePresence>
         {isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
               <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}
                  role="dialog" aria-modal="true" aria-label={title}
                  className={`bg-white rounded-2xl shadow-2xl w-full max-w-[540px] overflow-hidden border ${accent.border}`}>
                  <div className={`px-5 py-4 border-b ${accent.border} ${accent.background} flex items-start justify-between gap-3`}>
                     <div>
                        <div className={`font-bold flex items-center gap-2 ${accent.text}`}><BookOpen size={18} />{title}</div>
                        <p className="mt-1 text-xs text-slate-500">{subtitle || deepText(locale, "modal.notesScope")}</p>
                     </div>
                     <button type="button" aria-label={deepText(locale, "dialog.close")} onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-white/70"><X size={18} /></button>
                  </div>
                  <div className="p-5">
                     <textarea className={`w-full h-60 resize-y border border-slate-200 rounded-xl p-3 text-sm text-slate-700 outline-none focus:ring-2 ${accent.focus}`}
                        placeholder={deepText(locale, "modal.notesPlaceholder")}
                        value={draft} onChange={e => setDraft(e.target.value)} />
                     <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs text-slate-600 hover:bg-slate-100">{deepText(locale, "common.cancel")}</button>
                        <button type="button" onClick={save} className={`rounded-lg px-4 py-2 text-xs text-white shadow-sm flex items-center gap-2 ${accent.button}`}><Save size={14} /> {deepText(locale, "modal.saveNotes")}</button>
                     </div>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>
   );
};

const modalTheme = (tone: string) => tone === "officina"
   ? { header: "bg-[#e5f1fe] border-[#c3d8ee]", title: "text-[#37688f]", frame: "bg-[#f4f9ff] border-[#b6cfe8]", body: "bg-white text-[#243e5d] border-[#c3d8ee]", button: "bg-[#3475bc] hover:bg-[#265f9e]" }
   : tone === "story" ? { header: "bg-fuchsia-50 border-fuchsia-200", title: "text-fuchsia-800", frame: "bg-white border-fuchsia-200", body: "bg-fuchsia-50/30 text-slate-700 border-fuchsia-200", button: "bg-fuchsia-600 hover:bg-fuchsia-700" }
   : tone === "tela" ? { header: "bg-[#f2e5cf] border-[#e0cba9]", title: "text-[#8c683c]", frame: "bg-[#fffcf6] border-[#dcc9a9]", body: "bg-white text-[#594b39] border-[#d1b997]", button: "bg-[#765034] hover:bg-[#5c3c28]" }
   : tone === "viae" ? { header: "bg-[#eff2fa] border-[#d4dcef]", title: "text-[#536891]", frame: "bg-white border-[#bfc8df]", body: "bg-[#f7f9fe] text-slate-700 border-[#d4dcef]", button: "bg-[#6479a6] hover:bg-[#526996]" }
   : tone === "charta" ? { header: "bg-[#eff5eb] border-[#dae7d4]", title: "text-[#58764b]", frame: "bg-white border-[#cfddca]", body: "bg-[#f6faf4] text-slate-700 border-[#dae7d4]", button: "bg-[#6b8b5d] hover:bg-[#58764b]" }
   : { header: "bg-emerald-50 border-emerald-200", title: "text-emerald-800", frame: "bg-white border-emerald-200", body: "bg-emerald-50/30 text-slate-700 border-emerald-200", button: "bg-emerald-600 hover:bg-emerald-700" };

export const EditModal = ({ isOpen, onClose, content, setContent, onConfirm }: any) => {
   const { locale } = useLanguage();
   const { tone } = useAppDialog();
   const style = modalTheme(tone);
   return (
      <AnimatePresence>
         {isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
               <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} role="dialog" aria-modal="true" aria-label={deepText(locale, "modal.editMessage")}
                  className={`w-full max-w-[600px] overflow-hidden rounded-2xl border shadow-2xl ${style.frame}`}>
                  <header className={`flex items-center justify-between gap-3 border-b p-4 ${style.header}`}>
                     <h2 className={`flex items-center gap-2 text-sm font-bold ${style.title}`}><Edit2 size={17}/>{deepText(locale, "modal.editMessage")}</h2>
                     <button type="button" onClick={onClose} aria-label={deepText(locale, "modal.closeEdit")} className={style.title}><X size={19}/></button>
                  </header>
                  <div className="p-5">
                     <textarea value={content} onChange={e => setContent(e.target.value)}
                        className={`h-64 w-full resize-y rounded-xl border p-4 text-sm outline-none focus:ring-2 focus:ring-current/20 ${style.body}`} />
                  </div>
                  <footer className={`flex justify-end gap-2 border-t p-4 ${style.header}`}>
                     <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">{deepText(locale, "common.cancel")}</button>
                     <button type="button" onClick={onConfirm} className={`rounded-lg px-5 py-2 text-sm text-white shadow-sm ${style.button}`}>{deepText(locale, "modal.confirmRetry")}</button>
                  </footer>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>
   );
};

export const SuggestionModal = ({ isOpen, onClose, content, onConfirm, mode = "send" }: any) => {
   const { locale } = useLanguage();
   const { tone } = useAppDialog();
   const style = modalTheme(tone);
   return (
      <AnimatePresence>
         {isOpen && createPortal(
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
               <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} role="dialog" aria-modal="true" aria-label={deepText(locale, "modal.adopt")}
                  className={`w-full max-w-[540px] overflow-hidden rounded-2xl border shadow-2xl ${style.frame}`}>
                  <header className={`flex items-center gap-2 border-b p-4 ${style.header}`}>
                     <span>💡</span><h2 className={`text-sm font-bold ${style.title}`}>{deepText(locale, "modal.adopt")}</h2>
                  </header>
                  <div className="p-5">
                     <p className={`mb-2 text-xs uppercase tracking-wider ${style.title}`}>{deepText(locale, "modal.preview")}</p>
                     <div className={`max-h-[50dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-7 ${style.body}`}>{content}</div>
                     <p className={`mt-4 text-xs ${style.title}`}>{deepText(locale, mode === "insert" ? "modal.insertHelp" : "modal.sendHelp")}</p>
                  </div>
                  <footer className={`flex justify-end gap-2 border-t p-4 ${style.header}`}>
                     <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">{deepText(locale, "common.cancel")}</button>
                     <button type="button" onClick={onConfirm} className={`rounded-lg px-5 py-2 text-xs font-semibold text-white shadow-sm ${style.button}`}>{deepText(locale, mode === "insert" ? "story.suggestion.insertConfirm" : "story.suggestion.sendConfirm")}</button>
                  </footer>
               </motion.div>
            </motion.div>, document.body
         )}
      </AnimatePresence>
   );
};
