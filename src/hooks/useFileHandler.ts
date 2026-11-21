import { useRef } from "react";

export const useFileHandler = ({
    setSessions, setFolders, setGlobalWorldInfo, setBgImage, 
    setSelectedFile, showToast 
}: any) => {
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const permitted = /\.(?:txt|md|markdown|json|jsonl|csv|tsv|xml|yaml|yml|toml|ini|log|js|jsx|ts|tsx|py|css|scss|html|htm|sql|sh|bash|ps1|java|kt|go|rs|rb|php|c|cc|cpp|h|hpp|cs|swift|lua|vue|svelte|mjs|cjs|json5)$/i.test(f.name) || (f.type.startsWith("text/") && !/\.(?:svg|html?)$/i.test(f.name));
        if (!permitted || f.size > 1024 * 1024) {
            showToast?.("Cloud supports text/code attachments up to 1 MiB only.");
            e.target.value = "";
            return;
        }

        const r = new FileReader();
        r.onload = (ev) => {
            const result = ev.target?.result;
            if (typeof result === 'string') {
                setSelectedFile({
                    url: result,
                    type: 'text',
                    name: f.name
                });
            }
        };

        r.readAsText(f);
        
        e.target.value = '';
    };

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!/\.json$/i.test(f.name) || f.size > 2 * 1024 * 1024) {
            showToast?.("Cloud import accepts JSON up to 2 MiB.");
            e.target.value = "";
            return;
        }
        const r = new FileReader();
        r.onload = (ev) => {
            const content = ev.target?.result;
            if (typeof content === 'string') {
                try {
                    const d = JSON.parse(content);
                    if (d.sessions) setSessions(d.sessions);
                    if (d.folders) setFolders(d.folders);
                    if (d.globalWorldInfo || d.global_world_info) setGlobalWorldInfo(d.globalWorldInfo || d.global_world_info);
                    // Cloud ignores imported Local background image blobs.
                    
                    if (showToast) showToast("✅ Data Restored");
                } catch (err) {
                    console.error("Import Parse Error:", err);
                    if (showToast) showToast("❌ Corrupted File");
                }
            }
        };
        r.readAsText(f);
        e.target.value = '';
    };

    const handleBgDrop = (e: React.DragEvent) => {
        e.preventDefault();
        showToast?.("Cloud does not support uploading background images.");
    };

    return {
        fileInputRef,
        importInputRef,
        handleFileSelect,
        handleImportData,
        handleBgDrop
    };
};