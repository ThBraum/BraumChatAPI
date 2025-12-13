"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { AppShellProvider, useAppShell } from "@/components/providers/app-shell-provider";
import { useAuth } from "@/components/providers/auth-provider";
import type { Workspace } from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";
import { API_BASE_URL } from "@/lib/utils";

const ShellViewport = ({ children }: { children: React.ReactNode }) => {
    const { apiFetch } = useAuth();
    const { activeWorkspaceId, setActiveWorkspaceId } = useAppShell();
    const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

    const { data: workspaces = [], isLoading } = useQuery<Workspace[]>({
        queryKey: queryKeys.workspaces,
        queryFn: () => apiFetch("/workspaces"),
    });

    useEffect(() => {
        let mounted = true;

        const check = async () => {
            try {
                const res = await fetch(new URL("/health", API_BASE_URL).toString(), { method: "GET" });
                if (!mounted) return;
                setBackendHealthy(res.ok);
            } catch {
                if (!mounted) return;
                setBackendHealthy(false);
            }
        };

        check();
        const id = setInterval(check, 10000);
        return () => {
            mounted = false;
            clearInterval(id);
        };
    }, []);

    useEffect(() => {
        if (!activeWorkspaceId && workspaces.length > 0) {
            setActiveWorkspaceId(workspaces[0].id);
        }
    }, [activeWorkspaceId, setActiveWorkspaceId, workspaces]);

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            {backendHealthy === false && (
                <div className="bg-red-600 text-white px-4 py-2 text-sm text-center">
                    Backend indisponível em {API_BASE_URL} — algumas funcionalidades podem falhar.
                </div>
            )}
            <TopNav workspaces={workspaces} isLoadingWorkspaces={isLoading} />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar workspaces={workspaces} />
                <section className="flex flex-1 flex-col overflow-hidden bg-muted/10">
                    <div className="flex-1 overflow-y-auto">{children}</div>
                    <SiteFooter className="border-border/80 bg-background/60 px-6" />
                </section>
            </div>
        </div>
    );
};

export const AppChrome = ({ children }: { children: React.ReactNode }) => (
    <AppShellProvider>
        <ShellViewport>{children}</ShellViewport>
    </AppShellProvider>
);
