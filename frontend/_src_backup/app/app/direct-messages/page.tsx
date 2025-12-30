"use client";

import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { useAppShell } from "@/components/providers/app-shell-provider";
import type { FriendRequest, Thread, User } from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";

export default function DirectMessagesPage() {
    const { t } = useTranslation(["common"]);
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { apiFetch, user } = useAuth();
    const { activeWorkspaceId, setActiveChannelId, setActiveThreadId } = useAppShell();

    type Tab = "invite" | "friends" | "recent";
    const tab = (searchParams.get("tab") ?? "recent") as Tab;
    const setTab = (next: Tab) => {
        const sp = new URLSearchParams(searchParams.toString());
        sp.set("tab", next);
        router.replace(`/app/direct-messages?${sp.toString()}`);
    };

    type UserPublic = Pick<User, "id" | "display_name" | "avatar_url">;
    const pageSize = 20;

    const [inviteName, setInviteName] = useState("");
    const [friendsQuery, setFriendsQuery] = useState("");
    const [recentQuery, setRecentQuery] = useState("");

    const incomingRequestsQuery = useInfiniteQuery<FriendRequest[]>({
        queryKey: queryKeys.friendRequestsIncoming,
        queryFn: ({ pageParam }) =>
            apiFetch(`/friends/requests/incoming?limit=${pageSize}&offset=${Number(pageParam ?? 0)}`),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === pageSize ? allPages.length * pageSize : undefined,
        enabled: !!user,
    });

    const outgoingRequestsQuery = useInfiniteQuery<FriendRequest[]>({
        queryKey: queryKeys.friendRequestsOutgoing,
        queryFn: ({ pageParam }) =>
            apiFetch(`/friends/requests/outgoing?limit=${pageSize}&offset=${Number(pageParam ?? 0)}`),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === pageSize ? allPages.length * pageSize : undefined,
        enabled: !!user,
    });

    const friendsListQuery = useInfiniteQuery<UserPublic[]>({
        queryKey: queryKeys.friends(friendsQuery),
        queryFn: ({ pageParam }) => {
            const q = friendsQuery.trim();
            const qs = q ? `&q=${encodeURIComponent(q)}` : "";
            return apiFetch(`/friends?limit=${pageSize}&offset=${Number(pageParam ?? 0)}${qs}`);
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === pageSize ? allPages.length * pageSize : undefined,
        enabled: !!user,
    });

    const recentThreadsQuery = useInfiniteQuery<Thread[]>({
        queryKey: queryKeys.threadsRecent(activeWorkspaceId, recentQuery),
        queryFn: ({ pageParam }) => {
            const q = recentQuery.trim();
            const qs = q ? `&q=${encodeURIComponent(q)}` : "";
            return apiFetch(
                `/dm/threads?workspace_id=${encodeURIComponent(activeWorkspaceId ?? "")}&limit=${pageSize}&offset=${Number(pageParam ?? 0)}${qs}`,
            );
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === pageSize ? allPages.length * pageSize : undefined,
        enabled: !!activeWorkspaceId,
    });

    const sendFriendRequestMutation = useMutation({
        mutationFn: async (displayName: string) => {
            return apiFetch(`/friends/requests`, {
                method: "POST",
                body: JSON.stringify({ addressee_display_name: displayName }),
            });
        },
        onSuccess: () => {
            setInviteName("");
            queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsOutgoing });
            queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsIncoming });
        },
    });

    const acceptRequestMutation = useMutation({
        mutationFn: async (requestId: string) => apiFetch(`/friends/requests/${requestId}/accept`, { method: "POST" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsIncoming });
            queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsOutgoing });
            queryClient.invalidateQueries({ queryKey: ["friends"] });
        },
    });

    const declineRequestMutation = useMutation({
        mutationFn: async (requestId: string) => apiFetch(`/friends/requests/${requestId}/decline`, { method: "POST" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsIncoming });
        },
    });

    const createThreadMutation = useMutation({
        mutationFn: async (userId: string) => {
            if (!activeWorkspaceId) throw new Error(t("common:contacts.selectWorkspaceFirst"));
            return apiFetch<Thread>("/dm/threads", {
                method: "POST",
                body: JSON.stringify({ workspace_id: Number(activeWorkspaceId), user_id: Number(userId) }),
            });
        },
        onSuccess: async (thread) => {
            await queryClient.invalidateQueries({ queryKey: ["threads"] });
            setActiveChannelId(null);
            setActiveThreadId(String(thread.id));
            router.push("/app");
        },
    });

    const incomingRequests = useMemo(
        () => (incomingRequestsQuery.data?.pages ?? []).flat(),
        [incomingRequestsQuery.data],
    );
    const outgoingRequests = useMemo(
        () => (outgoingRequestsQuery.data?.pages ?? []).flat(),
        [outgoingRequestsQuery.data],
    );
    const friends = useMemo(() => (friendsListQuery.data?.pages ?? []).flat(), [friendsListQuery.data]);
    const threads = useMemo(() => (recentThreadsQuery.data?.pages ?? []).flat(), [recentThreadsQuery.data]);

    const incomingCount = incomingRequests.length;

    return (
        <div className="p-6 space-y-5">
            <div className="flex flex-col gap-3">
                <h1 className="text-xl font-semibold">{t("common:tabs.directMessages")}</h1>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={tab === "invite" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTab("invite")}
                    >
                        {t("common:contacts.invite")} {incomingCount ? `(${incomingCount})` : ""}
                    </Button>
                    <Button
                        variant={tab === "friends" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTab("friends")}
                    >
                        {t("common:tabs.contacts")}
                    </Button>
                    <Button
                        variant={tab === "recent" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTab("recent")}
                    >
                        {t("common:directMessages.title")}
                    </Button>
                </div>
            </div>

            <nav className="flex gap-2 text-sm">
                <Link className="text-primary hover:underline" href="/app/workspaces">
                    {t("common:tabs.workspaces")}
                </Link>
                <Link className="text-primary hover:underline" href="/app/direct-messages">
                    {t("common:tabs.directMessages")}
                </Link>
            </nav>

            {tab === "invite" && (
                <section className="space-y-4">
                    <div className="rounded-md border bg-background/50 p-4 space-y-3 max-w-2xl">
                        <div>
                            <div className="text-sm font-semibold">
                                {t("common:invites.title", { defaultValue: "Adicionar amigo" })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {t("common:invites.prompt", { defaultValue: "Display name para convidar" })}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={inviteName}
                                onChange={(e) => setInviteName(e.target.value)}
                                placeholder={t("common:invites.prompt")}
                            />
                            <Button
                                onClick={() => {
                                    const dn = inviteName.trim();
                                    if (!dn) return;
                                    sendFriendRequestMutation.mutate(dn);
                                }}
                                disabled={!user || sendFriendRequestMutation.isPending}
                            >
                                {t("common:contacts.invite", { defaultValue: "Convidar" })}
                            </Button>
                        </div>
                        {sendFriendRequestMutation.isError && (
                            <div className="text-xs text-red-500">
                                {(sendFriendRequestMutation.error as Error)?.message}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("common:invites.incoming", { defaultValue: "Pendentes" })}
                            </div>
                            <ul className="space-y-2">
                                {incomingRequests.map((req) => (
                                    <li key={req.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">{req.requester.display_name}</div>
                                            <div className="truncate text-xs text-muted-foreground">id: {req.requester.id}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => acceptRequestMutation.mutate(req.id)}
                                            >
                                                {t("common:invites.accept")}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => declineRequestMutation.mutate(req.id)}
                                            >
                                                {t("common:invites.decline")}
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                                {incomingRequests.length === 0 && (
                                    <li className="text-sm text-muted-foreground">{t("common:invites.none")}</li>
                                )}
                            </ul>
                            {incomingRequestsQuery.hasNextPage && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => incomingRequestsQuery.fetchNextPage()}
                                >
                                    {t("common:loadMore", { defaultValue: "Carregar mais" })}
                                </Button>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("common:invites.outgoing", { defaultValue: "Enviados" })}
                            </div>
                            <ul className="space-y-2">
                                {outgoingRequests.map((req) => (
                                    <li key={req.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">{req.addressee.display_name}</div>
                                            <div className="truncate text-xs text-muted-foreground">id: {req.addressee.id}</div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {t("common:invites.pending", { defaultValue: "Pendente" })}
                                        </span>
                                    </li>
                                ))}
                                {outgoingRequests.length === 0 && (
                                    <li className="text-sm text-muted-foreground">{t("common:invites.none")}</li>
                                )}
                            </ul>
                            {outgoingRequestsQuery.hasNextPage && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => outgoingRequestsQuery.fetchNextPage()}
                                >
                                    {t("common:loadMore", { defaultValue: "Carregar mais" })}
                                </Button>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {tab === "friends" && (
                <section className="space-y-3">
                    <div className="flex flex-col gap-2 max-w-md">
                        <Input
                            value={friendsQuery}
                            onChange={(e) => setFriendsQuery(e.target.value)}
                            placeholder={t("common:contacts.searchPlaceholder", { defaultValue: "Buscar amigos" })}
                        />
                    </div>

                    <ul className="space-y-2">
                        {friends.map((f) => (
                            <li key={f.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{f.display_name}</div>
                                    <div className="truncate text-xs text-muted-foreground">id: {f.id}</div>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => createThreadMutation.mutate(String(f.id))}
                                    disabled={!activeWorkspaceId}
                                    title={!activeWorkspaceId ? t("common:contacts.selectWorkspaceFirst") : t("common:contacts.openDmTitle")}
                                >
                                    {t("common:contacts.openDm")}
                                </Button>
                            </li>
                        ))}
                        {friends.length === 0 && (
                            <li className="text-sm text-muted-foreground">
                                {t("common:friends.none", { defaultValue: "Você ainda não tem amigos." })}
                            </li>
                        )}
                    </ul>

                    {friendsListQuery.hasNextPage && (
                        <Button variant="ghost" size="sm" onClick={() => friendsListQuery.fetchNextPage()}>
                            {t("common:loadMore", { defaultValue: "Carregar mais" })}
                        </Button>
                    )}
                </section>
            )}

            {tab === "recent" && (
                <section className="space-y-3">
                    {!activeWorkspaceId && (
                        <div className="text-sm text-muted-foreground">{t("common:contacts.selectWorkspaceFirst")}</div>
                    )}
                    <div className="flex flex-col gap-2 max-w-md">
                        <Input
                            value={recentQuery}
                            onChange={(e) => setRecentQuery(e.target.value)}
                            placeholder={t("common:directMessages.searchPlaceholder", { defaultValue: "Buscar conversas recentes" })}
                            disabled={!activeWorkspaceId}
                        />
                    </div>

                    {recentThreadsQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
                    ) : threads.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("common:directMessages.empty")}</p>
                    ) : (
                        <ul className="space-y-2">
                            {threads.map((thread) => (
                                <li key={thread.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">
                                            {thread.participants.map((p) => p.display_name).join(", ")}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setActiveChannelId(null);
                                            setActiveThreadId(String(thread.id));
                                            router.push("/app");
                                        }}
                                    >
                                        {t("common:directMessages.open")}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {recentThreadsQuery.hasNextPage && (
                        <Button variant="ghost" size="sm" onClick={() => recentThreadsQuery.fetchNextPage()}>
                            {t("common:loadMore", { defaultValue: "Carregar mais" })}
                        </Button>
                    )}
                </section>
            )}
        </div>
    );
}
