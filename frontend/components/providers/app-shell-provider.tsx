"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface AppShellContextValue {
    activeWorkspaceId: string | null;
    // Accept string or number (normalize to string internally)
    setActiveWorkspaceId: (id: string | number | null) => void;
    activeChannelId: string | null;
    setActiveChannelId: (id: string | null) => void;
    activeThreadId: string | null;
    setActiveThreadId: (id: string | null) => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export const AppShellProvider = ({ children }: { children: React.ReactNode }) => {
    const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

    const handleWorkspaceChange = useCallback((id: string | number | null) => {
        // normalize ID to string or null to avoid type mismatches
        const normalized = id === null || id === undefined ? null : String(id);
        setActiveWorkspace(normalized);
        setActiveChannelId(null);
        setActiveThreadId(null);
    }, []);

    const value = useMemo(
        () => ({
            activeWorkspaceId: activeWorkspace,
            setActiveWorkspaceId: (id: string | number | null) => handleWorkspaceChange(id),
            activeChannelId,
            setActiveChannelId,
            activeThreadId,
            setActiveThreadId,
        }),
        [handleWorkspaceChange, activeWorkspace, activeChannelId, activeThreadId],
    );

    return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
};

export const useAppShell = () => {
    const context = useContext(AppShellContext);
    if (!context) {
        throw new Error("useAppShell must be used within AppShellProvider");
    }
    return context;
};
