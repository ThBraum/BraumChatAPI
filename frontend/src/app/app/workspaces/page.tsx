"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { useAppShell } from "@/components/providers/app-shell-provider";
import { queryKeys } from "@/lib/query-keys";
import type { Workspace } from "@/lib/types";

export default function WorkspacesPage() {
    const { t } = useTranslation(["common"]);
    const { apiFetch } = useAuth();
    const queryClient = useQueryClient();
    const { activeWorkspaceId, setActiveWorkspaceId } = useAppShell();

    const workspacesQuery = useQuery<Workspace[]>({
        queryKey: queryKeys.workspaces,
        queryFn: () => apiFetch("/workspaces"),
    });

    const createWorkspaceMutation = useMutation({
        mutationFn: async (payload: { name: string; slug?: string }) => {
            return apiFetch<Workspace>("/workspaces", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: async (ws) => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
            setActiveWorkspaceId(ws.id);
        },
    });

    const workspaces = workspacesQuery.data ?? [];

    const handleCreate = () => {
        const name = prompt(t("common:workspaces.namePrompt"));
        if (!name?.trim()) return;
        const slug = prompt(t("common:workspaces.slugPrompt"))?.trim();
        createWorkspaceMutation.mutate({ name: name.trim(), slug: slug || undefined });
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">{t("common:workspaces.title")}</h1>
                <Button onClick={handleCreate}>{t("common:workspaces.create")}</Button>
            </div>

            <nav className="flex gap-2 text-sm">
                <Link className="text-primary hover:underline" href="/app/workspaces">
                    {t("common:tabs.workspaces")}
                </Link>
                <Link className="text-primary hover:underline" href="/app/contacts">
                    {t("common:tabs.contacts")}
                </Link>
                <Link className="text-primary hover:underline" href="/app/direct-messages">
                    {t("common:tabs.directMessages")}
                </Link>
            </nav>

            {workspacesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
            ) : (
                <ul className="space-y-2">
                    {workspaces.map((ws) => (
                        <li key={ws.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <div className="min-w-0">
                                <div className="truncate font-medium">{ws.name}</div>
                                {ws.slug && <div className="truncate text-xs text-muted-foreground">{ws.slug}</div>}
                            </div>
                            <Button
                                variant={activeWorkspaceId === String(ws.id) ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setActiveWorkspaceId(ws.id)}
                            >
                                {activeWorkspaceId === String(ws.id) ? t("common:workspaces.active") : t("common:workspaces.select")}
                            </Button>
                        </li>
                    ))}
                    {workspaces.length === 0 && (
                        <li className="text-sm text-muted-foreground">{t("common:workspaces.empty")}</li>
                    )}
                </ul>
            )}
        </div>
    );
}
