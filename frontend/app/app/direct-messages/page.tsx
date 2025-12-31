"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { useAppShell } from "@/components/providers/app-shell-provider";
import type { FriendRequest, Thread, User } from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";

type UserPublic = Pick<User, "id" | "display_name" | "avatar_url">;

type TabKey = "invite" | "friends" | "recent";

const pageSize = 20;

function DirectMessagesPageInner() {
  const { apiFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspaceId, setActiveThreadId, setActiveChannelId } =
    useAppShell();
  const { t } = useTranslation(["navigation", "common"]);

  const tab = ((searchParams.get("tab") as TabKey | null) ??
    "invite") as TabKey;

  const [userSearch, setUserSearch] = useState("");
  const [friendsQuery, setFriendsQuery] = useState("");
  const [recentQuery, setRecentQuery] = useState("");

  const usersQuery = useQuery<UserPublic[]>({
    queryKey: ["users", "search", userSearch.trim()],
    queryFn: async () => {
      const q = userSearch.trim();
      return apiFetch(
        `/users/search?q=${encodeURIComponent(q)}&limit=${pageSize}`,
      );
    },
    enabled: tab === "invite" && userSearch.trim().length >= 2,
  });

  const incomingQuery = useInfiniteQuery<FriendRequest[]>({
    queryKey: queryKeys.friendRequestsIncoming,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiFetch(
        `/friends/requests/incoming?limit=${pageSize}&offset=${Number(pageParam ?? 0)}`,
      ),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return allPages.length * pageSize;
    },
    enabled: tab === "invite",
  });

  const outgoingQuery = useInfiniteQuery<FriendRequest[]>({
    queryKey: queryKeys.friendRequestsOutgoing,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiFetch(
        `/friends/requests/outgoing?limit=${pageSize}&offset=${Number(pageParam ?? 0)}`,
      ),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return allPages.length * pageSize;
    },
    enabled: tab === "invite",
  });

  const friendsQueryResult = useInfiniteQuery<UserPublic[]>({
    queryKey: queryKeys.friends(friendsQuery),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const qs = friendsQuery.trim()
        ? `&q=${encodeURIComponent(friendsQuery.trim())}`
        : "";
      return apiFetch(
        `/friends?limit=${pageSize}&offset=${Number(pageParam ?? 0)}${qs}`,
      );
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return allPages.length * pageSize;
    },
    enabled: tab === "friends",
  });

  const recentThreadsQuery = useInfiniteQuery<Thread[]>({
    queryKey: queryKeys.threadsRecent(activeWorkspaceId, recentQuery),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const qs = recentQuery.trim()
        ? `&q=${encodeURIComponent(recentQuery.trim())}`
        : "";
      const ws = activeWorkspaceId
        ? `workspace_id=${encodeURIComponent(activeWorkspaceId)}`
        : "";
      const wsPart = ws ? `${ws}&` : "";
      return apiFetch(
        `/dm/threads?${wsPart}limit=${pageSize}&offset=${Number(pageParam ?? 0)}${qs}`,
      );
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return allPages.length * pageSize;
    },
    enabled: tab === "recent",
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (displayName: string) => {
      return apiFetch<FriendRequest>(`/friends/requests`, {
        method: "POST",
        body: JSON.stringify({ addressee_display_name: displayName.trim() }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.friendRequestsOutgoing,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.friendRequestsIncoming,
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) =>
      apiFetch(`/friends/requests/${requestId}/accept`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.friendRequestsIncoming,
      });
      // atualiza lista de amigos
      await queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (requestId: string) =>
      apiFetch(`/friends/requests/${requestId}/decline`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.friendRequestsIncoming,
      });
    },
  });

  const openDmMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!activeWorkspaceId)
        throw new Error(
          t("navigation:directMessagesPage.errors.selectWorkspace"),
        );
      return apiFetch<Thread>("/dm/threads", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: Number(activeWorkspaceId),
          user_id: Number(userId),
        }),
      });
    },
    onSuccess: async (thread) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.threadsList(activeWorkspaceId),
      });
      setActiveChannelId(null);
      setActiveThreadId(thread.id);
      router.push("/app");
    },
  });

  const incoming = useMemo(
    () => (incomingQuery.data?.pages ?? []).flat(),
    [incomingQuery.data],
  );
  const outgoing = useMemo(
    () => (outgoingQuery.data?.pages ?? []).flat(),
    [outgoingQuery.data],
  );
  const friends = useMemo(
    () => (friendsQueryResult.data?.pages ?? []).flat(),
    [friendsQueryResult.data],
  );
  const recentThreads = useMemo(
    () => (recentThreadsQuery.data?.pages ?? []).flat(),
    [recentThreadsQuery.data],
  );

  const outgoingByAddresseeId = useMemo(() => {
    const map = new Map<string, FriendRequest>();
    for (const req of outgoing) map.set(String(req.addressee.id), req);
    return map;
  }, [outgoing]);

  const incomingByRequesterId = useMemo(() => {
    const map = new Map<string, FriendRequest>();
    for (const req of incoming) map.set(String(req.requester.id), req);
    return map;
  }, [incoming]);

  const searchedUsers = useMemo(() => {
    const list = usersQuery.data ?? [];
    if (!user?.id) return list;
    return list.filter((u) => u.id !== user.id);
  }, [user, usersQuery.data]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {t("navigation:directMessagesPage.title")}
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/app/direct-messages?tab=invite">
          <Button
            variant={tab === "invite" ? "secondary" : "outline"}
            size="sm"
          >
            {t("navigation:directMessagesPage.tabs.invite")}
          </Button>
        </Link>
        <Link href="/app/direct-messages?tab=friends">
          <Button
            variant={tab === "friends" ? "secondary" : "outline"}
            size="sm"
          >
            {t("navigation:directMessagesPage.tabs.friends")}
          </Button>
        </Link>
        <Link href="/app/direct-messages?tab=recent">
          <Button
            variant={tab === "recent" ? "secondary" : "outline"}
            size="sm"
          >
            {t("navigation:directMessagesPage.tabs.recent")}
          </Button>
        </Link>
      </div>

      {tab === "invite" && (
        <div className="space-y-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">
                {t("navigation:directMessagesPage.invite.findTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder={t(
                  "navigation:directMessagesPage.invite.searchPlaceholder",
                )}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />

              {userSearch.trim().length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  {t("navigation:directMessagesPage.invite.typeMore")}
                </p>
              ) : usersQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t("common:loading")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {searchedUsers.map((u) => {
                    const incomingReq = incomingByRequesterId.get(String(u.id));
                    const outgoingReq = outgoingByAddresseeId.get(String(u.id));
                    const canInvite = !incomingReq && !outgoingReq;

                    return (
                      <li
                        key={u.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {u.display_name}
                          </div>
                        </div>

                        {incomingReq ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                acceptMutation.mutate(incomingReq.id)
                              }
                              disabled={acceptMutation.isPending}
                            >
                              {t("navigation:directMessagesPage.invite.accept")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                declineMutation.mutate(incomingReq.id)
                              }
                              disabled={declineMutation.isPending}
                            >
                              {t(
                                "navigation:directMessagesPage.invite.decline",
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              sendInviteMutation.mutate(u.display_name)
                            }
                            disabled={
                              !canInvite || sendInviteMutation.isPending
                            }
                            variant={outgoingReq ? "outline" : "default"}
                          >
                            {outgoingReq
                              ? t("navigation:directMessagesPage.invite.sent")
                              : t(
                                  "navigation:directMessagesPage.invite.invite",
                                )}
                          </Button>
                        )}
                      </li>
                    );
                  })}

                  {searchedUsers.length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      {t("navigation:directMessagesPage.invite.noUsers")}
                    </li>
                  )}
                </ul>
              )}

              {(usersQuery.isError || sendInviteMutation.isError) && (
                <p className="text-sm text-red-600">
                  {
                    ((usersQuery.error ?? sendInviteMutation.error) as Error)
                      ?.message
                  }
                </p>
              )}
            </CardContent>
          </Card>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("navigation:directMessagesPage.invite.incomingTitle")}
            </h2>
            <ul className="space-y-2">
              {incoming.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {req.requester.display_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      status: {req.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => acceptMutation.mutate(req.id)}
                      disabled={acceptMutation.isPending}
                    >
                      {t("navigation:directMessagesPage.invite.accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => declineMutation.mutate(req.id)}
                      disabled={declineMutation.isPending}
                    >
                      {t("navigation:directMessagesPage.invite.decline")}
                    </Button>
                  </div>
                </li>
              ))}
              {incoming.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {t("navigation:directMessagesPage.invite.nonePending")}
                </li>
              )}
            </ul>
            {incomingQuery.hasNextPage && (
              <Button
                variant="outline"
                onClick={() => incomingQuery.fetchNextPage()}
                disabled={incomingQuery.isFetchingNextPage}
              >
                {t("navigation:directMessagesPage.loadMore")}
              </Button>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("navigation:directMessagesPage.invite.outgoingTitle")}
            </h2>
            <ul className="space-y-2">
              {outgoing.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {req.addressee.display_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      status: {req.status}
                    </div>
                  </div>
                </li>
              ))}
              {outgoing.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {t("navigation:directMessagesPage.invite.noneOutgoing")}
                </li>
              )}
            </ul>
            {outgoingQuery.hasNextPage && (
              <Button
                variant="outline"
                onClick={() => outgoingQuery.fetchNextPage()}
                disabled={outgoingQuery.isFetchingNextPage}
              >
                {t("navigation:directMessagesPage.loadMore")}
              </Button>
            )}
          </section>
        </div>
      )}

      {tab === "friends" && (
        <div className="space-y-4">
          <section className="space-y-2 max-w-md">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("navigation:directMessagesPage.tabs.friends")}
            </h2>
            <Input
              placeholder={t(
                "navigation:directMessagesPage.friends.searchPlaceholder",
              )}
              value={friendsQuery}
              onChange={(e) => setFriendsQuery(e.target.value)}
            />
            {!activeWorkspaceId && (
              <p className="text-sm text-muted-foreground">
                {t("navigation:directMessagesPage.errors.selectWorkspace")}
              </p>
            )}
          </section>

          <ul className="space-y-2">
            {friends.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{u.display_name}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => openDmMutation.mutate(String(u.id))}
                  disabled={!activeWorkspaceId || openDmMutation.isPending}
                >
                  {t("navigation:directMessagesPage.friends.openDm")}
                </Button>
              </li>
            ))}
            {friends.length === 0 && (
              <li className="text-sm text-muted-foreground">
                {t("navigation:directMessagesPage.friends.noFriends")}
              </li>
            )}
          </ul>

          {friendsQueryResult.hasNextPage && (
            <Button
              variant="outline"
              onClick={() => friendsQueryResult.fetchNextPage()}
              disabled={friendsQueryResult.isFetchingNextPage}
            >
              {t("navigation:directMessagesPage.loadMore")}
            </Button>
          )}
        </div>
      )}

      {tab === "recent" && (
        <div className="space-y-4">
          <section className="space-y-2 max-w-md">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("navigation:directMessagesPage.tabs.recent")}
            </h2>
            <Input
              placeholder={t(
                "navigation:directMessagesPage.recent.searchPlaceholder",
              )}
              value={recentQuery}
              onChange={(e) => setRecentQuery(e.target.value)}
            />
          </section>

          <ul className="space-y-2">
            {recentThreads.map((thread) => (
              <li
                key={thread.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
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
                    setActiveThreadId(thread.id);
                    router.push("/app");
                  }}
                >
                  {t("navigation:directMessagesPage.recent.open")}
                </Button>
              </li>
            ))}
            {recentThreads.length === 0 && (
              <li className="text-sm text-muted-foreground">
                {t("navigation:directMessagesPage.recent.noThreads")}
              </li>
            )}
          </ul>

          {recentThreadsQuery.hasNextPage && (
            <Button
              variant="outline"
              onClick={() => recentThreadsQuery.fetchNextPage()}
              disabled={recentThreadsQuery.isFetchingNextPage}
            >
              {t("navigation:directMessagesPage.loadMore")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DirectMessagesPage() {
  return (
    <Suspense fallback={null}>
      <DirectMessagesPageInner />
    </Suspense>
  );
}
