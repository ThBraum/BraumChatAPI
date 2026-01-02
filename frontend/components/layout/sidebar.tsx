"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/providers/auth-provider";
import { useAppShell } from "@/components/providers/app-shell-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
    Channel,
    FriendRequest,
    Thread,
    Workspace,
    WorkspaceInvite,
} from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";

interface SidebarProps {
    workspaces: Workspace[];
}

const SidebarContent = ({
    channels,
    threads,
    invites,
    friendRequests,
    onSelectChannel,
    onSelectThread,
    activeChannelId,
    activeThreadId,
    onCreateChannel,
    onCreateThread,
    onAcceptInvite,
    onDeclineInvite,
    onAcceptFriendRequest,
    onDeclineFriendRequest,
    currentUserId,
}: {
    channels: Channel[];
    threads: Thread[];
    invites: WorkspaceInvite[];
    friendRequests: FriendRequest[];
    onSelectChannel: (id: string) => void;
    onSelectThread: (id: string) => void;
    activeChannelId: string | null;
    activeThreadId: string | null;
    onCreateChannel: () => void;
    onCreateThread: () => void;
    onAcceptInvite: (id: string) => void;
    onDeclineInvite: (id: string) => void;
    onAcceptFriendRequest: (id: string) => void;
    onDeclineFriendRequest: (id: string) => void;
    currentUserId: string | null;
}) => {
    const { t } = useTranslation(["navigation", "common"]);

    const splitDiscordDisplayName = (displayName: string) => {
        const idx = displayName.lastIndexOf("#");
        if (idx > 0 && idx < displayName.length - 1) {
            return displayName.slice(0, idx);
        }
        return displayName;
    };

    const getThreadLabel = (thread: Thread) => {
        const participants = thread.participants ?? [];
        const others = currentUserId
            ? participants.filter((p) => String(p.id) !== String(currentUserId))
            : participants;
        const displayList = (others.length > 0 ? others : participants)
            .map((p) => splitDiscordDisplayName(p.display_name ?? String(p.id)))
            .filter(Boolean);
        return displayList.join(", ") || "Direct Message";
    };

    const pendingCount = invites.length + friendRequests.length;

    return (
        <div className="flex h-full flex-col">
            <ScrollArea className="flex-1">
                <div className="px-4 py-6">
                    <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>{t("navigation:channels")}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={onCreateChannel}
                        >
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
                                        activeChannelId === channel.id &&
                                        "bg-accent text-accent-foreground",
                                    )}
                                >
                                    <span className="text-xs text-muted-foreground">#</span>
                                    <span className="truncate text-left text-sm">
                                        {channel.name}
                                    </span>
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
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={onCreateThread}
                        >
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
                                        activeThreadId === thread.id &&
                                        "bg-accent text-accent-foreground",
                                    )}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="truncate text-left text-sm">
                                        {getThreadLabel(thread)}
                                    </span>
                                    {Number(thread.unread_count ?? 0) > 0 &&
                                        activeThreadId !== thread.id && (
                                            <Badge
                                                variant="secondary"
                                                className="ml-auto shrink-0"
                                            >
                                                {Number(thread.unread_count ?? 0)}
                                            </Badge>
                                        )}
                                </button>
                            </li>
                        ))}
                        {threads.length === 0 && (
                            <li className="px-3 py-2 text-xs text-muted-foreground">
                                {t("navigation:createThread")}
                            </li>
                        )}
                    </ul>

                    <div className="mt-8 mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>
                            {t("navigation:invites")}
                            {pendingCount ? ` (${pendingCount})` : ""}
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {friendRequests.map((req) => (
                            <li
                                key={`fr:${req.id}`}
                                className="rounded-md border bg-background/50 px-3 py-2"
                            >
                                <div className="text-sm text-foreground truncate">
                                    {req.requester.display_name ?? req.requester.id}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {t("common:invites.title", {
                                        defaultValue: "Adicionar amigo",
                                    })}
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => onAcceptFriendRequest(String(req.id))}
                                    >
                                        {t("common:invites.accept")}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => onDeclineFriendRequest(String(req.id))}
                                    >
                                        {t("common:invites.decline")}
                                    </Button>
                                </div>
                            </li>
                        ))}
                        {invites.map((invite) => (
                            <li
                                key={invite.id}
                                className="rounded-md border bg-background/50 px-3 py-2"
                            >
                                <div className="text-sm text-foreground truncate">
                                    {invite.workspace_name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {t("common:labels.from")}{" "}
                                    {invite.inviter.display_name ?? invite.inviter.id}
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => onAcceptInvite(invite.id)}
                                    >
                                        {t("common:invites.accept")}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => onDeclineInvite(invite.id)}
                                    >
                                        {t("common:invites.decline")}
                                    </Button>
                                </div>
                            </li>
                        ))}
                        {pendingCount === 0 && (
                            <li className="px-3 py-2 text-xs text-muted-foreground">
                                {t("common:invites.none")}
                            </li>
                        )}
                    </ul>
                </div>
            </ScrollArea>
        </div>
    );
};

export const Sidebar = ({ workspaces }: SidebarProps) => {
    const router = useRouter();
    const { apiFetch, user } = useAuth();
    const queryClient = useQueryClient();
    const {
        activeWorkspaceId,
        activeChannelId,
        setActiveChannelId,
        activeThreadId,
        setActiveThreadId,
    } = useAppShell();
    const { t } = useTranslation(["navigation", "common"]);
    const [open, setOpen] = useState(false);

    const channelsQuery = useQuery<Channel[]>({
        queryKey: queryKeys.channels(activeWorkspaceId ?? undefined),
        queryFn: () => apiFetch(`/workspaces/${activeWorkspaceId}/channels`),
        enabled: !!activeWorkspaceId,
    });

    const threadsQuery = useQuery<Thread[]>({
        queryKey: queryKeys.threadsList(activeWorkspaceId ?? undefined),
        queryFn: () => apiFetch(`/dm/threads?workspace_id=${activeWorkspaceId}`),
        enabled: !!activeWorkspaceId,
    });

    const invitesQuery = useQuery<WorkspaceInvite[]>({
        queryKey: queryKeys.incomingInvites,
        queryFn: () => apiFetch(`/invites/incoming`),
        enabled: !!user,
    });

    const friendRequestsPreviewQuery = useQuery<FriendRequest[]>({
        queryKey: queryKeys.friendRequestsIncomingPreview,
        queryFn: () => apiFetch(`/friends/requests/incoming?limit=10&offset=0`),
        enabled: !!user,
    });

    const createChannelMutation = useMutation({
        mutationFn: async (name: string) => {
            return apiFetch(`/workspaces/${activeWorkspaceId}/channels`, {
                method: "POST",
                body: JSON.stringify({ name }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.channels(activeWorkspaceId ?? undefined),
            });
        },
    });

    const inviteUserMutation = useMutation({
        mutationFn: async (displayName: string) => {
            if (!activeWorkspaceId) throw new Error("No workspace selected");
            return apiFetch(`/workspaces/${activeWorkspaceId}/invites`, {
                method: "POST",
                body: JSON.stringify({ invitee_display_name: displayName }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.incomingInvites });
            queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
            // feedback simples
            window.alert(t("common:invites.sent"));
        },
        onError: (err: unknown) => {
            const msg = (err as Error)?.message ?? String(err);
            window.alert(t("common:invites.error", { message: msg }));
        },
    });

    const acceptInviteMutation = useMutation({
        mutationFn: async (inviteId: string) => {
            return apiFetch(`/invites/${inviteId}/accept`, { method: "POST" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.incomingInvites });
            queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        },
    });

    const declineInviteMutation = useMutation({
        mutationFn: async (inviteId: string) => {
            return apiFetch(`/invites/${inviteId}/decline`, { method: "POST" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.incomingInvites });
        },
    });

    const acceptFriendRequestMutation = useMutation({
        mutationFn: async (requestId: string) =>
            apiFetch(`/friends/requests/${requestId}/accept`, { method: "POST" }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.friendRequestsIncoming,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.friendRequestsIncomingPreview,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.friendRequestsOutgoing,
            });
            queryClient.invalidateQueries({ queryKey: ["friends"] });
        },
    });

    const declineFriendRequestMutation = useMutation({
        mutationFn: async (requestId: string) =>
            apiFetch(`/friends/requests/${requestId}/decline`, { method: "POST" }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.friendRequestsIncoming,
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.friendRequestsIncomingPreview,
            });
        },
    });

    const channels = channelsQuery.data ?? [];
    const threads = threadsQuery.data ?? [];
    const invites = invitesQuery.data ?? [];
    const friendRequests = friendRequestsPreviewQuery.data ?? [];

    const pendingCount = invites.length + friendRequests.length;

    const handleCreateChannel = () => {
        if (!activeWorkspaceId) return;
        const name = prompt(t("navigation:createChannel") ?? "New channel");
        if (name) {
            createChannelMutation.mutate(name);
        }
    };

    const handleCreateThread = () => {
        router.push("/app/direct-messages?tab=invite");
    };

    const handleInviteUser = () => {
        if (!activeWorkspaceId) {
            window.alert(t("common:contacts.selectWorkspaceFirst"));
            return;
        }
        const displayName = prompt(t("common:invites.prompt"));
        if (displayName) {
            inviteUserMutation.mutate(displayName.trim());
        }
    };

    const content = (
        <SidebarContent
            channels={channels}
            threads={threads}
            invites={invites}
            friendRequests={friendRequests}
            currentUserId={user?.id ? String(user.id) : null}
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
            onAcceptInvite={(id) => acceptInviteMutation.mutate(id)}
            onDeclineInvite={(id) => declineInviteMutation.mutate(id)}
            onAcceptFriendRequest={(id) => acceptFriendRequestMutation.mutate(id)}
            onDeclineFriendRequest={(id) => declineFriendRequestMutation.mutate(id)}
        />
    );

    const workspaceLabel = useMemo(() => {
        return (
            workspaces.find((w) => w.id === activeWorkspaceId)?.name ??
            t("navigation:workspace")
        );
    }, [activeWorkspaceId, t, workspaces]);

    return (
        <>
            <aside className="hidden w-64 flex-col border-r bg-card md:flex">
                <div className="flex items-center justify-between px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="truncate">{workspaceLabel}</span>
                    {pendingCount > 0 && (
                        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                            {pendingCount}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleInviteUser}
                        disabled={!activeWorkspaceId}
                        title={t("common:invites.title")}
                    >
                        <Users className="h-4 w-4" />
                    </Button>
                </div>
                {content}
            </aside>

            <div className="flex items-center border-b px-4 py-2 md:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <span className="truncate">{workspaceLabel}</span>
                            {pendingCount > 0 && (
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                                    {pendingCount}
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="w-72 p-0"
                        title={workspaceLabel}
                        closeLabel={t("common:close")}
                    >
                        <div className="flex items-center justify-between border-b px-4 py-3 text-sm font-semibold">
                            <span className="truncate">{workspaceLabel}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={handleInviteUser}
                                disabled={!activeWorkspaceId}
                                title={t("common:invites.title")}
                            >
                                <Users className="h-4 w-4" />
                            </Button>
                        </div>
                        {content}
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
};
