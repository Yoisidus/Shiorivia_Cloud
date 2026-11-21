import { useState, useEffect } from "react";
import { EffectType } from "../components/TransitionEffects";
import { useAppDialog } from "../context/DialogContext";

export const useUI = () => {
    const dialog = useAppDialog();
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
    
    const [showModelPanel, setShowModelPanel] = useState(true);
    const [showChatPanel, setShowChatPanel] = useState(true);
    const [showCodeRepo, setShowCodeRepo] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [debugMode, setDebugMode] = useState(false);
    
    const [showGlobalWorld, setShowGlobalWorld] = useState(false);
    const [showLocalWorld, setShowLocalWorld] = useState(false);
    
    const [effect, setEffect] = useState<EffectType>("none");
    const [editModal, setEditModal] = useState<{ isOpen: boolean, text: string, index: number }>({ isOpen: false, text: "", index: -1 });

    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth > 768) {
            setLeftSidebarOpen(true);
        }
    }, []);

    // Legacy callers share the single global, mode-aware feedback host.
    const showToast = dialog.notify;

    return {
        leftSidebarOpen, setLeftSidebarOpen,
        rightSidebarOpen, setRightSidebarOpen,
        showModelPanel, setShowModelPanel,
        showChatPanel, setShowChatPanel,
        showCodeRepo, setShowCodeRepo,
        showSaveModal, setShowSaveModal,
        showGlobalWorld, setShowGlobalWorld,
        showLocalWorld, setShowLocalWorld,
        showToast,
        effect, setEffect,
        editModal, setEditModal,
        debugMode, setDebugMode,
    };
};