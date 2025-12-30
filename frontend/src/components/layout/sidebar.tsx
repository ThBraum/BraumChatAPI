"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/providers/auth-provider";
import { useAppShell } from "@/components/providers/app-shell-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Channel, Thread, Workspace } from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";

interface SidebarProps {
    workspaces: Workspace[];
}

const SidebarContent = ({
    channels,
    threads,
    onSelectChannel,
    onSelectThread,
    activeChannelId,
    activeThreadId,
    onCreateChannel,
    onCreateThread,
}: {
    channels: Channel[];
    threads: Thread[];
    onSelectChannel: (id: string) => void;
    onSelectThread: (id: string) => void;
    activeChannelId: string | null;
    activeThreadId: string | null;
    onCreateChannel: () => void;
    onCreateThread: () => void;
}) => {
    const { t } = useTranslation(["navigation"]);

    return (
        <div className="flex h-full flex-col">
            <ScrollArea className="flex-1">
                <div className="px-4 py-6">
                    <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>{t("navigation:channels")}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCreateChannel}>
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <ul className="space-y-1">
                        {channels.map((channel) => (
                            <li key={channel.id}>
                                <button
                                    onClick={() => onSelectChannel(channel.id)}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
                                        activeChannelId === channel.id && "bg-accent text-accent-foreground",
                                    )}
                                >
                                    <span className="text-xs text-muted-foreground">#</span>
                                    <span className="truncate text-left text-sm">{channel.name}</span>
                                    {channel.is_private && (
                                        <Users className="ml-auto h-3.5 w-3.5 opacity-70" />
                                    )}
                                </button>
                            </li>
                        ))}
                        {channels.length === 0 && (
                            <li className="px-3 py-2 text-xs text-muted-foreground">
                                {t("navigation:createChannel")}
                            </li>
                        )}
                    </ul>

                    <div className="mt-8 mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>{t("navigation:directMessages")}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCreateThread}>
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <ul className="space-y-1">
                        {threads.map((thread) => (
                            <li key={thread.id}>
                                <button
                                    onClick={() => onSelectThread(thread.id)}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
                                        activeThreadId === thread.id && "bg-accent text-accent-foreground",
                                    )}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="truncate text-left text-sm">
                                        {thread.participants.map((p) => p.display_name).join(", ")}
                                    </span>
                                </button>
                            </li>
                        ))}
                        {threads.length === 0 && (
                            <li className="px-3 py-2 text-xs text-muted-foreground">
                                {t("navigation:createThread")}
                            </li>
                        )}
                    </ul>
                </div>
            </ScrollArea>
        </div>
    );
};

export const Sidebar = ({ workspaces }: SidebarProps) => {
    const { apiFetch } = useAuth();
    const queryClient = useQueryClient();
    const {
        activeWorkspaceId,
        activeChannelId,
        setActiveChannelId,
        activeThreadId,
        setActiveThreadId,
    } = useAppShell();
    const { t } = useTranslation(["navigation"]);
    const [open, setOpen] = useState(false);

    const channelsQuery = useQuery<Channel[]>({
        queryKey: queryKeys.channels(activeWorkspaceId ?? undefined),
        queryFn: () => apiFetch(`/workspaces/${activeWorkspaceId}/channels`),
        enabled: !!activeWorkspaceId,
    });

    const threadsQuery = useQuery<Thread[]>({
        queryKey: queryKeys.threads,
        queryFn: () => apiFetch(`/dm/threads?workspace_id=${encodeURIComponent(activeWorkspaceId ?? "")}`),
        enabled: !!activeWorkspaceId,
    });

    const createChannelMutation = useMutation({
        mutationFn: async (name: string) => {
            return apiFetch(`/workspaces/${activeWorkspaceId}/channels`, {
                method: "POST",
                body: JSON.stringify({ name }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.channels(activeWorkspaceId ?? undefined) });
        },
    });

    const createThreadMutation = useMutation({
        mutationFn: async (participant: string) => {
            if (!activeWorkspaceId) throw new Error("Missing active workspace");
            return apiFetch(`/dm/threads`, {
                method: "POST",
                body: JSON.stringify({ workspace_id: Number(activeWorkspaceId), participant_email: participant }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.threads });
        },
    });

    const channels = channelsQuery.data ?? [];
    const threads = threadsQuery.data ?? [];

    const handleCreateChannel = () => {
        if (!activeWorkspaceId) return;
        const name = prompt(t("navigation:createChannel") ?? "New channel");
        if (name) {
            createChannelMutation.mutate(name);
        }
    };

    const handleCreateThread = () => {
        const email = prompt(t("navigation:createThread") ?? "New DM");
        if (email) {
            createThreadMutation.mutate(email);
        }
    };

    const content = (
        <SidebarContent
            channels={channels}
            threads={threads}
            onSelectChannel={(id) => {
                setActiveThreadId(null);
                setActiveChannelId(id);
                setOpen(false);
            }}
            onSelectThread={(id) => {
                setActiveChannelId(null);
                setActiveThreadId(id);
                setOpen(false);
            }}
            activeChannelId={activeChannelId}
            activeThreadId={activeThreadId}
            onCreateChannel={handleCreateChannel}
            onCreateThread={handleCreateThread}
        />
    );

    const workspaceLabel = useMemo(() => {
        return workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? t("navigation:workspace");
    }, [activeWorkspaceId, t, workspaces]);

    return (
        <>
            <aside className="hidden w-64 flex-col border-r bg-card md:flex">
                <div className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {workspaceLabel}
                </div>
                {content}
            </aside>

            <div className="flex items-center border-b px-4 py-2 md:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm">
                            {workspaceLabel}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0">
                        <div className="border-b px-4 py-3 text-sm font-semibold">{workspaceLabel}</div>
                        {content}
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
};
