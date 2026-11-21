"use client";
import { useState, useEffect } from "react";
import {
    Lock, Check, FileCode, Plus, Trash2, Copy,
    Search, Terminal, X, Maximize2, Minimize2,
    Sidebar, RefreshCw, MoreHorizontal, Download, Sparkles, FolderPlus, Folder, HardDrive, ChevronDown
} from "lucide-react";
import { CodeFile } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDialog } from "../context/DialogContext";
import { useLanguage } from "../context/LanguageContext";
import { deepText } from "../lib/i18nDeep";

const CodeEditor = ({ repository, onUpdate, onClose, isFullScreen, toggleFullScreen, projectRoot, onBindProject }: any) => {
    const { locale } = useLanguage();
    const dialog = useAppDialog();
    const text = (key: string) => deepText(locale, `ide.ui.${key}`);
    const fill = (key: string, args: Record<string, string | number>) =>
        text(key).replace(/\{(\w+)\}/g, (_, field: string) => String(args[field] ?? ""));
    const [files, setFiles] = useState<Record<string, CodeFile>>({});
    const [activeFile, setActiveFile] = useState<string>("");
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [fileMenu, setFileMenu] = useState<string | null>(null);
    const [diskBaseline, setDiskBaseline] = useState<Record<string, CodeFile>>({});
    const [tree, setTree] = useState<{ path: string; type: "file" | "directory" }[]>([]);
    const [projects, setProjects] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [status, setStatus] = useState("");
    const ideRequest = async (action: string, args: Record<string, unknown> = {}) => {
        const response = await fetch("/api/ide", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, ...args }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || text("operationFailed"));
        return result;
    };
    const syncDisk = async (target = projectRoot, confirmDiscard = true) => {
        if (!target) return;
        const hasDraft = isEditing && Object.entries(files).some(([name, file]) =>
            diskBaseline[name]?.content !== file.content);
        if (confirmDiscard && hasDraft && !await dialog.confirm(text("unsavedSync"))) return;
        setBusy(true);
        try {
            const [filesResponse, treeResponse] = await Promise.all([
                fetch(`/api/ide?action=snapshot&project=${encodeURIComponent(target)}`, { cache: "no-store" }),
                fetch(`/api/ide?action=tree&project=${encodeURIComponent(target)}`, { cache: "no-store" }),
            ]);
            const snapshots = await filesResponse.json(), folders = await treeResponse.json();
            if (!filesResponse.ok || !treeResponse.ok) throw new Error(snapshots.error || folders.error || text("readFailed"));
            const nextFiles = snapshots.files || {};
            setFiles(nextFiles);
            setDiskBaseline(nextFiles);
            setTree(Array.isArray(folders.entries) ? folders.entries : []);
            setActiveFile(current => current in nextFiles ? current : Object.keys(nextFiles)[0] || "");
            setIsEditing(false);
            setStatus(fill("synced", { project: target, count: Object.keys(nextFiles).length }));
        } catch (error: any) { setStatus(error.message); dialog.notify(error.message); }
        finally { setBusy(false); }
    };

    const [showSidebar, setShowSidebar] = useState(true);

    useEffect(() => {
        if (!projectRoot) {
            setFiles(repository || {});
            setDiskBaseline(repository || {});
            setTree([]);
            setActiveFile(Object.keys(repository || {})[0] || "");
        } else {
            void syncDisk(projectRoot);
        }
        if (typeof window !== "undefined" && window.innerWidth < 768) setShowSidebar(false);
        // A parent rerender must not re-fetch and silently discard unsaved edits.
        // The project binding, not the new identity of an empty {} prop, controls sync.
    }, [projectRoot]);

    const handleSave = async () => {
        if (!await dialog.confirm(text("saveAsk"))) return;
        if (!projectRoot) {
            onUpdate(files);
            setIsEditing(false);
            return;
        }
        setBusy(true);
        try {
            for (const [name, file] of Object.entries(files) as [string, CodeFile][]) {
                if (diskBaseline[name]?.content !== file.content) {
                    await ideRequest("write", { project: projectRoot, path: name, content: file.content });
                }
            }
            await syncDisk(projectRoot, false);
        } catch (error: any) { dialog.notify(error.message); }
        finally { setBusy(false); }
    };

    const handleCancel = () => {
        setFiles(projectRoot ? diskBaseline : repository || {});
        setIsEditing(false);
    };

    const handleNewFile = async () => {
        const name = await dialog.prompt(text("filePathAsk"));
        if (!name) return;
        if (!/^[^\\/:*?"<>|]+(?:\/[^\\/:*?"<>|]+)*$/.test(name) || name.split("/").includes("..")) {
            dialog.notify(text("invalidPath")); return;
        }
        setFiles(prev => ({ ...prev, [name]: { name, language: name.split(".").pop() || "text", content: "" } }));
        setActiveFile(name);
        setIsEditing(true);
        setShowSidebar(true);
    };
    const importLegacyRepository = async () => {
        if (!projectRoot) return;
        const legacy = Object.entries(repository || {}) as [string, CodeFile][];
        if (!legacy.length) return;
        if (!await dialog.confirm(fill("importLegacyAsk", { count: legacy.length, project: projectRoot }))) return;
        setBusy(true);
        try {
            for (const [name, file] of legacy) {
                await ideRequest("write", { project: projectRoot, path: name, content: file.content });
            }
            await syncDisk(projectRoot, false);
        } catch (error: any) { dialog.notify(`${text("importAborted")}${error.message}`); }
        finally { setBusy(false); }
    };
    const handleNewFolder = async () => {
        if (!projectRoot) { dialog.notify(text("bindRequired")); return; }
        const relative = await dialog.prompt(text("newFolderAsk"));
        if (!relative) return;
        try {
            await ideRequest("createFolder", { project: projectRoot, path: relative });
            await syncDisk(projectRoot);
        } catch (e: any) { dialog.notify(e.message); }
    };
    const loadProjects = async () => {
        try {
            const response = await fetch("/api/ide?action=projects", { cache: "no-store" });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || text("loadProjectsFailed"));
            setProjects(result.projects || []);
        } catch (e: any) { dialog.notify(e.message); }
    };
    const createAndBind = async () => {
        const name = await dialog.prompt(text("createProjectAsk"));
        if (!name) return;
        try {
            const created = await ideRequest("createProject", { name });
            onBindProject(created.project);
            setProjects(prev => [...new Set([...prev, created.project])]);
        } catch (e: any) { dialog.notify(e.message); }
    };

    const handleDelete = async (e: React.MouseEvent, name: string) => {
        e.stopPropagation();
        setFileMenu(null);
        if (!await dialog.confirm(fill("deleteAsk", { name }))) return;
        const updated = { ...files };
        delete updated[name];
        if (projectRoot && name in diskBaseline) {
            try { await ideRequest("delete", { project: projectRoot, path: name }); }
            catch (error: any) { dialog.notify(error.message); return; }
        } else if (!projectRoot) onUpdate(updated);
        setFiles(updated);
        if (projectRoot) setDiskBaseline(prev => { const next = { ...prev }; delete next[name]; return next; });
        if (activeFile === name) setActiveFile(Object.keys(updated)[0] || "");
    };
    const handleDownload = (e: React.MouseEvent, name: string) => {
        e.stopPropagation();
        setFileMenu(null);
        const file = files[name];
        if (!file) return;
        const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name.split(/[\\/]/).pop() || "source.txt";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`bg-[#0b1125] flex flex-col text-[#cbd6f1] font-mono text-xs overflow-hidden shadow-[0_30px_100px_rgba(8,13,34,.48)] border-[#7788b6]/30 ${isFullScreen ? 'fixed inset-0 z-[100]' : 'w-full h-[min(80dvh,820px)] min-h-[550px] rounded-2xl border'}`}>

            <div className="bg-[linear-gradient(110deg,#162546,#242343_65%,#322b4c)] px-4 py-3 border-b border-[#7d83b5]/25 flex justify-between items-center select-none shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        className={`p-1 rounded hover:bg-white/10 ${showSidebar ? 'text-blue-400' : 'text-slate-500'}`}
                        title={text("sidebar")} aria-label={text("sidebar")}
                    >
                        <Sidebar size={14} />
                    </button>

                    <div className="flex items-center gap-2 font-bold text-slate-200">
                        <Sparkles size={14} className="text-[#a6b9fc]" />
                        <span className="hidden md:inline">OFFICINA IDE</span>
                        <button type="button" onClick={() => { void loadProjects(); setShowProjectPicker(v => !v); }}
                            className="flex max-w-[230px] items-center gap-2 truncate rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-normal text-[#c6d3f2] hover:bg-white/10"
                            title={projectRoot ? `${text("currentProject")} IDE/${projectRoot}` : text("bindProject")}>
                            <HardDrive size={12} className="shrink-0"/>
                            <span className="truncate">{projectRoot ? `IDE/${projectRoot}` : text("unboundProject")}</span>
                            <ChevronDown size={12}/>
                        </button>
                        <span className="md:hidden text-[#a6b9fc] truncate max-w-[100px]">{activeFile}</span>
                    </div>
                </div>

                <div className="flex gap-2 items-center">

                    {isEditing && (
                        <button onClick={handleCancel} className="p-1.5 hover:bg-white/10 rounded text-red-400" title={text("discard")} aria-label={text("discard")}>
                            <X size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                        className={`p-1.5 rounded transition-colors ${isEditing ? 'bg-[#394c7d]/60 text-[#c7d4ff] animate-pulse' : 'hover:bg-white/10 text-slate-400'}`}
                        title={text(isEditing ? "commit" : "edit")} aria-label={text(isEditing ? "commit" : "edit")}
                    >
                        {isEditing ? <Check size={14} /> : <Lock size={14} />}
                    </button>

                    <button type="button" disabled={busy || !projectRoot} onClick={() => void syncDisk()}
                        className="flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1.5 text-[#c1d1fa] hover:bg-white/10 disabled:opacity-40"
                        title={text("syncHint")}>
                        <RefreshCw size={14} className={busy ? "animate-spin" : ""}/><span className="hidden sm:inline text-[11px]">{text("sync")}</span>
                    </button>
                    <button type="button" disabled={!projectRoot || busy} onClick={handleNewFolder} className="p-1.5 hover:bg-white/10 rounded text-slate-300 disabled:opacity-40" title={text("newFolder")}><FolderPlus size={14}/></button>
                    {projectRoot && Object.keys(repository || {}).length > 0 && (
                        <button type="button" disabled={busy} onClick={importLegacyRepository}
                            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-indigo-300/30 px-2 py-1.5 text-[11px] text-[#b3c5f2] hover:bg-white/10 disabled:opacity-40"
                            title={text("importLegacyHint")}>
                            <HardDrive size={13}/> {text("importLegacy")}
                        </button>
                    )}
                    <button onClick={handleNewFile} className="p-1.5 hover:bg-white/10 rounded text-slate-300" title={text("newFile")} aria-label={text("newFile")}><Plus size={14} /></button>
                    <button onClick={toggleFullScreen} className="p-1.5 hover:bg-white/10 rounded text-slate-300" title={text(isFullScreen ? "exitFullscreen" : "enterFullscreen")} aria-label={text(isFullScreen ? "exitFullscreen" : "enterFullscreen")}>
                        {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-red-900/50 rounded text-slate-300 hover:text-red-400" title={text("close")} aria-label={text("close")}>
                        <X size={14} />
                    </button>
                </div>
            </div>

            {showProjectPicker && <div className="shrink-0 border-b border-[#6579a4]/40 bg-[#172543] px-4 py-3">
                <p className="mb-2 text-[11px] text-[#a9b9dc]">{text("projectHelp")}</p>
                <div className="flex flex-wrap gap-2">
                    {projects.map(name => <button type="button" key={name} onClick={() => {
                        onBindProject(name); setShowProjectPicker(false);
                    }} className={`rounded-lg border px-3 py-1.5 text-xs ${name === projectRoot ? "border-[#acbbf6] bg-[#3d4a79] text-white" : "border-[#495b82] bg-[#202f52] hover:bg-[#36466a]"}`}>
                        <Folder size={12} className="mr-1 inline"/>{name}
                    </button>)}
                    <button type="button" onClick={createAndBind} className="rounded-lg border border-[#7b89bb] bg-[#3b4670] px-3 py-1.5 text-xs hover:bg-[#4d5b89]">
                        <Plus size={12} className="mr-1 inline"/> {text("newProject")}
                    </button>
                </div>
            </div>}
            {status && <div role="status" className="shrink-0 border-b border-[#526587]/30 bg-[#17223c] px-4 py-1.5 text-[10px] text-[#b9c7e6]">{status}</div>}
            <div className="flex flex-1 min-h-0 relative">
                {showSidebar && (
                    <div className="w-1/3 md:w-56 bg-[#121c36] border-r border-[#879bcc]/20 flex flex-col absolute inset-y-0 left-0 z-10 md:static">
                        <div className="p-2 border-b border-[#879bcc]/20">
                            <div className="relative">
                                <Search size={10} className="absolute left-2 top-1.5 text-slate-500" />
                                <input className="w-full bg-[#1d2b4c] border border-[#6579a4]/30 rounded-lg px-6 py-1 outline-none text-slate-200 placeholder-slate-500" placeholder={text("search")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
                            {tree.filter(entry => entry.type === "directory" && entry.path.toLowerCase().includes(searchTerm.toLowerCase())).map(entry =>
                                <div key={`folder:${entry.path}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-[#98adce]"
                                    style={{ paddingLeft: Math.min(45, 8 + entry.path.split("/").length * 7) }}>
                                    <Folder size={12} className="shrink-0 text-[#879be0]"/><span className="truncate" title={entry.path}>{entry.path.split("/").pop()}</span>
                                </div>
                            )}
                            {Object.keys(files).filter(f => f.toLowerCase().includes(searchTerm.toLowerCase())).map(fileName => (
                                <div
                                    key={fileName}
                                    onClick={() => { setActiveFile(fileName); setFileMenu(null); if (window.innerWidth < 768) setShowSidebar(false); }} // 手机上选完文件自动收起
                                    style={{ paddingLeft: Math.min(45, 8 + fileName.split("/").length * 7) }}
                                    className={`flex justify-between items-center px-2 py-1.5 rounded cursor-pointer group ${activeFile === fileName ? 'bg-[#34476e] text-white' : 'hover:bg-[#253557]'}`}
                                >
                                    <span className="flex items-center gap-2 truncate text-[11px]">
                                        <FileCode size={12} className="text-blue-400 flex-shrink-0" />
                                        <span className="truncate">{fileName}</span>
                                    </span>
                                    <div className="relative shrink-0">
                                        <button type="button" onClick={e => { e.stopPropagation(); setFileMenu(fileMenu === fileName ? null : fileName); }}
                                            className="rounded-md p-1 text-[#a8b7d8] opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-white/10"
                                            aria-label={`${text("fileActions")}：${fileName}`} aria-expanded={fileMenu === fileName}>
                                            <MoreHorizontal size={15}/>
                                        </button>
                                        {fileMenu === fileName && <div className="absolute right-0 top-full z-40 mt-1 w-32 rounded-xl border border-[#52678e]/60 bg-[#202f52] p-1 text-[11px] shadow-2xl">
                                            <button type="button" onClick={e => handleDownload(e, fileName)}
                                                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-white/10">
                                                <Download size={13}/> {text("download")}
                                            </button>
                                            <button type="button" onClick={e => handleDelete(e, fileName)}
                                                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[#ffb2c0] hover:bg-[#ad4767]/20">
                                                <Trash2 size={13}/> {deepText(locale, "common.delete")}
                                            </button>
                                        </div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={`flex-1 flex flex-col bg-[#0e1730] relative transition-all ${showSidebar ? 'ml-[33.33%] md:ml-0' : 'ml-0'}`}>

                    {activeFile ? (
                        <div className="relative flex-1 min-h-0 flex flex-col h-full">

                            <div
                                className="absolute top-2 right-4 z-10 opacity-30 hover:opacity-100 cursor-pointer transition-opacity p-1 bg-black/50 rounded"
                                onClick={() => { void navigator.clipboard.writeText(files[activeFile].content).then(() => dialog.notify(text("codeCopied"), { type: "success" })).catch(() => dialog.notify(text("copyFailed"), { type: "error" })); }}
                                title={text("copyContent")} role="button" aria-label={text("copyContent")} tabIndex={0}
                            >
                                <Copy size={14} />
                            </div>

                            <textarea
                                value={files[activeFile]?.content || ""}
                                onChange={(e) => setFiles({ ...files, [activeFile]: { ...files[activeFile], content: e.target.value } })}
                                disabled={!isEditing}
                                spellCheck={false}
                                className={`w-full flex-1 bg-transparent p-4 outline-none resize-none font-mono leading-relaxed ${isEditing ? 'text-white' : 'text-slate-400'}`}
                                style={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: isFullScreen ? '14px' : '12px' }}
                            />

                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-600 flex-col gap-2 select-none">
                            <Terminal size={32} className="opacity-20" />
                            <span>{text("noFile")}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const CodeRepositoryModal = ({ isOpen, onClose, repository, onUpdate, projectRoot, onBindProject }: any) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={`fixed inset-0 z-[80] bg-[#080e22]/75 backdrop-blur-[8px] flex items-center justify-center ${isFullScreen ? 'p-0' : 'p-3 md:p-6'}`}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                        className={isFullScreen ? "w-full h-full" : "w-full max-w-[960px]"}
                    >
                        <CodeEditor
                            repository={repository}
                            onUpdate={onUpdate}
                            projectRoot={projectRoot} onBindProject={onBindProject}
                            onClose={onClose}
                            isFullScreen={isFullScreen}
                            toggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};