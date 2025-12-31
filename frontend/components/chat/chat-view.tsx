"use client";

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/providers/auth-provider";
import { useAppShell } from "@/components/providers/app-shell-provider";
import { MessageList } from "@/components/chat/message-list";
import { MessageComposer } from "@/components/chat/message-composer";
import { PresencePanel } from "@/components/chat/presence-panel";
import type {
    Channel,
    Message,
    PresenceUser,
    Thread,
    UserOnlineStatus,
} from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";
import { useChannelSocket } from "@/hooks/use-channel-socket";
import { useDmSocket } from "@/hooks/use-dm-socket";
import { useWsToken } from "@/hooks/use-ws-token";
import type { MessageValues } from "@/lib/validation";

interface ChatViewProps {
    workspaceId: string | null;
    channelId: string | null;
    threadId: string | null;
}

export const ChatView = ({
    workspaceId,
    channelId,
    threadId,
}: ChatViewProps) => {
    const { apiFetch, accessToken, user } = useAuth();
    const { setActiveThreadId, setActiveChannelId } = useAppShell();
    const queryClient = useQueryClient();
    const { t } = useTranslation(["chat", "common"]);
    const currentUserId = user?.id ?? null;
    const wsToken = useWsToken(Boolean(accessToken));
    const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
    const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
        new Map(),
    );

    const messageScrollRef = useRef<HTMLDivElement | null>(null);
    const messageBottomRef = useRef<HTMLDivElement | null>(null);
    const shouldStickToBottomRef = useRef(true);
    const didInitialScrollRef = useRef<string | null>(null);
    const scrollAnchorMessageIdRef = useRef<string | null>(null);
    const scrollAnchorOffsetPxRef = useRef<number>(0);

    const escapeAttrValue = useCallback((value: string) => {
        if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
            return CSS.escape(value);
        }
        return value.replace(/"/g, '\\"');
    }, []);

    const captureScrollAnchor = useCallback(() => {
        const el = messageScrollRef.current;
        if (!el) return;

        const messageEls = el.querySelectorAll<HTMLElement>("[data-message-id]");
        if (messageEls.length === 0) return;

        const containerTop = el.getBoundingClientRect().top;
        for (const messageEl of Array.from(messageEls)) {
            const rect = messageEl.getBoundingClientRect();
            const isVisible = rect.bottom > containerTop;
            if (!isVisible) continue;

            const id = messageEl.dataset.messageId;
            if (!id) continue;
            scrollAnchorMessageIdRef.current = id;
            scrollAnchorOffsetPxRef.current = rect.top - containerTop;
            return;
        }
    }, []);

    const scrollToBottom = useCallback(() => {
        const el = messageScrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        shouldStickToBottomRef.current = true;
    }, []);

    const sortMessagesAsc = useCallback((messages: Message[]) => {
        return [...messages].sort((a, b) => {
            const aTime = new Date(a.created_at).getTime();
            const bTime = new Date(b.created_at).getTime();
            if (aTime !== bTime) return aTime - bTime;
            return String(a.id).localeCompare(String(b.id));
        });
    }, []);

    const makeClientId = useCallback(() => {
        if (typeof globalThis !== "undefined") {
            const maybeCrypto = (globalThis as unknown as { crypto?: Crypto }).crypto;
            if (maybeCrypto?.randomUUID) return maybeCrypto.randomUUID();
        }
        return `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }, []);

    const splitDiscordDisplayName = useCallback((displayName: string) => {
        const idx = displayName.lastIndexOf("#");
        if (idx > 0 && idx < displayName.length - 1) {
            return {
                name: displayName.slice(0, idx),
                code: displayName.slice(idx), // includes '#'
            };
        }
        return { name: displayName, code: null as string | null };
    }, []);

    const channelQuery = useQuery<Channel>({
        queryKey: ["channel", channelId],
        queryFn: () => apiFetch(`/channels/${channelId}`),
        enabled: !!channelId,
    });

    const messageQueryKey = channelId
        ? queryKeys.channelMessages(channelId)
        : threadId
            ? queryKeys.threadMessages(threadId)
            : ["messages", "noop"];

    const messagesQuery = useQuery<Message[]>({
        queryKey: messageQueryKey,
        queryFn: () =>
            channelId
                ? apiFetch(`/channels/${channelId}/messages`)
                : apiFetch(`/dm/threads/${threadId}/messages`),
        enabled: !!channelId || !!threadId,
        select: (data) => sortMessagesAsc(data ?? []),
    });

    const { refetch: refetchMessages } = messagesQuery;

    const presenceQuery = useQuery<PresenceUser[]>({
        queryKey: queryKeys.presence(channelId ?? undefined),
        queryFn: () => apiFetch(`/channels/${channelId}/presence`),
        enabled: !!channelId,
        refetchInterval: 1000 * 30,
    });

    const threadsQuery = useQuery<Thread[]>({
        queryKey: queryKeys.threadsList(workspaceId ?? undefined),
        queryFn: () =>
            apiFetch(
                `/dm/threads?workspace_id=${encodeURIComponent(workspaceId ?? "")}`,
            ),
        enabled: !!workspaceId && !!threadId,
        staleTime: 1000 * 15,
    });

    const activeThread = useMemo(() => {
        if (!threadId) return null;
        const fromList = (threadsQuery.data ?? []).find(
            (th) => String(th.id) === String(threadId),
        );
        if (fromList) return fromList;
        const cached =
            queryClient.getQueryData<Thread[]>(
                queryKeys.threadsList(workspaceId ?? undefined),
            ) ?? [];
        return cached.find((th) => String(th.id) === String(threadId)) ?? null;
    }, [queryClient, threadId, threadsQuery.data, workspaceId]);

    const dmOtherParticipant = useMemo(() => {
        if (!threadId) return null;
        const participants = activeThread?.participants ?? [];
        const otherFromThread =
            participants.find((p) => String(p.id) !== String(currentUserId ?? "")) ??
            null;
        if (otherFromThread) return otherFromThread;

        // fallback: infer from messages
        const otherFromMessages = (messagesQuery.data ?? [])
            .map((m) => m.author)
            .find((a) => String(a?.id) !== String(currentUserId ?? ""));
        return otherFromMessages ?? null;
    }, [activeThread?.participants, currentUserId, messagesQuery.data, threadId]);

    const dmOtherParts = dmOtherParticipant?.display_name
        ? splitDiscordDisplayName(dmOtherParticipant.display_name)
        : null;

    // Se houver threads duplicadas/invertidas no backend (legado), garanta que ambos os usuários
    // convergem para o mesmo `threadId` canônico ao abrir o DM.
    useEffect(() => {
        if (channelId) return;
        if (!workspaceId || !threadId || !dmOtherParticipant?.id) return;

        let cancelled = false;
        const run = async () => {
            try {
                const canonical = await apiFetch<Thread>("/dm/threads", {
                    method: "POST",
                    body: JSON.stringify({
                        workspace_id: Number(workspaceId),
                        user_id: Number(dmOtherParticipant.id),
                    }),
                });
                if (cancelled) return;
                const nextId = String(canonical?.id ?? "");
                if (nextId && nextId !== String(threadId)) {
                    setActiveChannelId(null);
                    setActiveThreadId(nextId);
                }
            } catch {
                // best-effort: se falhar, mantém o threadId atual.
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [
        apiFetch,
        channelId,
        dmOtherParticipant?.id,
        setActiveChannelId,
        setActiveThreadId,
        threadId,
        workspaceId,
    ]);

    const dmOnlineQuery = useQuery<UserOnlineStatus[]>({
        queryKey: queryKeys.usersOnline(
            dmOtherParticipant?.id ? String(dmOtherParticipant.id) : "",
        ),
        queryFn: async () => {
            const id = String(dmOtherParticipant?.id ?? "");
            return apiFetch(`/users/online?ids=${encodeURIComponent(id)}`);
        },
        enabled: !!dmOtherParticipant?.id,
        refetchInterval: 1000 * 15,
    });

    const dmIsOnline = useMemo(() => {
        const row = (dmOnlineQuery.data ?? [])[0];
        return Boolean(row?.online);
    }, [dmOnlineQuery.data]);

    const resolveDisplayName = useCallback(
        (userId: string) => {
            const fromPresence = (presenceQuery.data ?? []).find(
                (u) => u.user_id === userId,
            )?.display_name;
            if (fromPresence) return fromPresence;
            const fromMessages = (messagesQuery.data ?? []).find(
                (m) => m.user_id === userId,
            )?.author?.display_name;
            if (fromMessages) return fromMessages;
            return t("chat:userFallback", { id: userId });
        },
        [messagesQuery.data, presenceQuery.data, t],
    );

    const handleIncomingTyping = useCallback(
        (userId: string | number, isTyping: boolean) => {
            const normalizedUserId = String(userId);

            // ignore self-typing if echoed
            if (currentUserId && normalizedUserId === String(currentUserId)) return;

            const existingTimer = typingTimersRef.current.get(normalizedUserId);
            if (existingTimer) clearTimeout(existingTimer);

            if (!isTyping) {
                typingTimersRef.current.delete(normalizedUserId);
                setTypingUserIds((prev) =>
                    prev.filter((id) => id !== normalizedUserId),
                );
                return;
            }

            setTypingUserIds((prev) =>
                prev.includes(normalizedUserId) ? prev : [...prev, normalizedUserId],
            );
            const timer = setTimeout(() => {
                typingTimersRef.current.delete(normalizedUserId);
                setTypingUserIds((prev) =>
                    prev.filter((id) => id !== normalizedUserId),
                );
            }, 2500);
            typingTimersRef.current.set(normalizedUserId, timer);
        },
        [currentUserId],
    );

    const handleIncomingPresence = useCallback(
        (userId: string | number, online: boolean) => {
            const normalizedUserId = String(userId);
            // Update React Query cache used by dmOnlineQuery so status flips instantly.
            queryClient.setQueryData<UserOnlineStatus[]>(
                queryKeys.usersOnline(normalizedUserId),
                [{ user_id: normalizedUserId, online }],
            );
        },
        [queryClient],
    );

    const channelSocket = useChannelSocket({
        workspaceId,
        channelId,
        token: wsToken,
        onMessage: (payload) => {
            if (payload.type === "message" && channelId) {
                queryClient.setQueryData<Message[]>(
                    queryKeys.channelMessages(channelId),
                    (prev: Message[] | undefined) => {
                        const list = prev ?? [];
                        const existsById = list.some(
                            (msg: Message) => msg.id === payload.payload.id,
                        );
                        if (existsById) return list;

                        const incomingClientId = payload.payload.client_id;
                        if (incomingClientId) {
                            const idx = list.findIndex(
                                (m) => m.client_id === incomingClientId,
                            );
                            if (idx >= 0) {
                                const next = [...list];
                                next[idx] = payload.payload;
                                return sortMessagesAsc(next);
                            }
                        }
                        return sortMessagesAsc([...list, payload.payload]);
                    },
                );
            }
            if (payload.type === "typing") {
                handleIncomingTyping(
                    payload.payload.user_id,
                    payload.payload.is_typing,
                );
            }
        },
    });

    const dmSocket = useDmSocket({
        threadId,
        token: wsToken,
        onMessage: (payload) => {
            if (payload.type === "message" && threadId) {
                queryClient.setQueryData<Message[]>(
                    queryKeys.threadMessages(threadId),
                    (prev: Message[] | undefined) => {
                        const list = prev ?? [];
                        const existsById = list.some(
                            (msg: Message) => msg.id === payload.payload.id,
                        );
                        if (existsById) return list;

                        const incomingClientId = payload.payload.client_id;
                        if (incomingClientId) {
                            const idx = list.findIndex(
                                (m) => m.client_id === incomingClientId,
                            );
                            if (idx >= 0) {
                                const next = [...list];
                                next[idx] = payload.payload;
                                return sortMessagesAsc(next);
                            }
                        }
                        return sortMessagesAsc([...list, payload.payload]);
                    },
                );
            }
            if (payload.type === "typing") {
                if (process.env.NODE_ENV !== "production") {
                    console.warn("DM WS typing received", payload.payload);
                }
                handleIncomingTyping(
                    payload.payload.user_id,
                    payload.payload.is_typing,
                );
            }
            if (payload.type === "presence") {
                handleIncomingPresence(payload.payload.user_id, payload.payload.online);
            }
        },
    });

    const shouldPollMessages = useMemo(() => {
        if (channelId) return !channelSocket.isOpen;
        if (threadId) return !dmSocket.isOpen;
        return false;
    }, [channelId, channelSocket.isOpen, dmSocket.isOpen, threadId]);

    useEffect(() => {
        if (!shouldPollMessages) return;

        // Fallback: se WS caiu (ex.: 1006/403), puxa mensagens via REST.
        void refetchMessages();
        const interval = setInterval(() => {
            void refetchMessages();
        }, 2500);

        return () => {
            clearInterval(interval);
        };
    }, [channelId, refetchMessages, shouldPollMessages, threadId]);

    const sendTyping = useCallback(
        (isTyping: boolean) => {
            if (channelId) {
                channelSocket.send({ type: "typing", is_typing: isTyping });
            } else if (threadId) {
                dmSocket.send({ type: "typing", is_typing: isTyping });
            }
        },
        [channelId, channelSocket, dmSocket, threadId],
    );

    const sendMessage = useMutation({
        mutationFn: async (values: MessageValues & { client_id: string }) => {
            if (channelId) {
                const sent = channelSocket.send({
                    type: "message",
                    content: values.content,
                    client_id: values.client_id,
                });
                if (!sent) {
                    return apiFetch<Message>(`/channels/${channelId}/messages`, {
                        method: "POST",
                        body: JSON.stringify(values),
                    });
                }

                return undefined;
            } else if (threadId) {
                const sent = dmSocket.send({
                    type: "message",
                    content: values.content,
                    client_id: values.client_id,
                });
                if (!sent) {
                    return apiFetch<Message>(`/dm/threads/${threadId}/messages`, {
                        method: "POST",
                        body: JSON.stringify(values),
                    });
                }

                return undefined;
            }
            throw new Error("Missing destination");
        },
        onMutate: async (values) => {
            const nowIso = new Date().toISOString();
            const targetKey = channelId
                ? queryKeys.channelMessages(channelId)
                : threadId
                    ? queryKeys.threadMessages(threadId)
                    : messageQueryKey;
            const optimistic: Message = {
                id: `client:${values.client_id}`,
                client_id: values.client_id,
                content: values.content,
                created_at: nowIso,
                user_id: String(currentUserId ?? ""),
                author: {
                    id: String(user?.id ?? ""),
                    display_name: user?.display_name ?? "",
                    avatar_url: user?.avatar_url ?? null,
                },
                channel_id: channelId ?? undefined,
                thread_id: threadId ?? undefined,
            };

            queryClient.setQueryData<Message[]>(targetKey, (prev) => {
                const list = prev ?? [];
                if (list.some((m) => m.client_id === values.client_id)) return list;
                return sortMessagesAsc([...list, optimistic]);
            });

            return { clientId: values.client_id, targetKey };
        },
        onSuccess: (created, _values, ctx) => {
            if (!created) return;
            const targetKey = ctx?.targetKey ?? messageQueryKey;
            queryClient.setQueryData<Message[]>(targetKey, (prev) => {
                const list = prev ?? [];
                if (list.some((m) => m.id === created.id)) return list;
                if (created.client_id) {
                    const idx = list.findIndex((m) => m.client_id === created.client_id);
                    if (idx >= 0) {
                        const next = [...list];
                        next[idx] = created;
                        return sortMessagesAsc(next);
                    }
                }
                return sortMessagesAsc([...list, created]);
            });
        },
        onError: async (_err, values, ctx) => {
            // Se o POST falhar, tenta refetch antes de remover a otimista (pode ter persistido mesmo assim).
            const targetKey = ctx?.targetKey ?? messageQueryKey;

            try {
                await queryClient.refetchQueries({ queryKey: targetKey, exact: true });
            } catch {
                // ignore
            }

            const list = queryClient.getQueryData<Message[]>(targetKey) ?? [];
            const stillPresent = list.some(
                (m) =>
                    m.client_id === values.client_id ||
                    m.id === `client:${values.client_id}`,
            );
            if (stillPresent) return;

            queryClient.setQueryData<Message[]>(targetKey, (prev) =>
                (prev ?? []).filter(
                    (m) =>
                        m.client_id !== values.client_id &&
                        m.id !== `client:${values.client_id}`,
                ),
            );
        },
    });

    const header = useMemo(() => {
        if (channelId && channelQuery.data) {
            return {
                title: `#${channelQuery.data.name}`,
                subtitle:
                    channelQuery.data.topic ??
                    t("chat:header.realtime", {
                        defaultValue: "Messages are synced in realtime",
                    }),
                placeholder: t("chat:composer.placeholder", {
                    name: channelQuery.data.name,
                    defaultValue: "Message #{{name}}",
                }),
            };
        }

        if (threadId) {
            const name =
                dmOtherParts?.name ??
                dmOtherParticipant?.display_name ??
                t("chat:dm.unknownUser", { defaultValue: "Direct Message" });
            const status = dmIsOnline
                ? t("common:status.online")
                : t("common:status.offline");
            const subtitle = t("chat:dm.subtitleNoCode", {
                status,
                defaultValue: "{{status}}",
            });

            return {
                title: name,
                subtitle,
                placeholder: t("chat:composer.placeholderDm", {
                    name,
                    defaultValue: "Message @{{name}}",
                }),
            };
        }

        return {
            title: t("chat:emptyState.title"),
            subtitle: t("chat:emptyState.subtitle"),
            placeholder: "",
        };
    }, [
        channelId,
        channelQuery.data,
        dmIsOnline,
        dmOtherParticipant?.display_name,
        dmOtherParts?.name,
        t,
        threadId,
    ]);

    const handleMessageScroll = useCallback(() => {
        const el = messageScrollRef.current;
        if (!el) return;
        const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        shouldStickToBottomRef.current = distanceToBottom < 64;

        if (!shouldStickToBottomRef.current) {
            captureScrollAnchor();
        }
    }, [captureScrollAnchor]);

    // Scroll inicial para o final (mensagens mais recentes embaixo).
    useEffect(() => {
        const key = channelId
            ? `c:${channelId}`
            : threadId
                ? `t:${threadId}`
                : null;
        if (!key) return;
        if (messagesQuery.isLoading) return;
        if (didInitialScrollRef.current === key) return;

        shouldStickToBottomRef.current = true;
        scrollAnchorMessageIdRef.current = null;

        didInitialScrollRef.current = key;
        requestAnimationFrame(() => {
            scrollToBottom();
        });
    }, [channelId, messagesQuery.isLoading, scrollToBottom, threadId]);

    // Mantém no final quando novas mensagens chegam (se usuário já estava no final).
    useEffect(() => {
        if (!shouldStickToBottomRef.current) return;
        scrollToBottom();
    }, [messagesQuery.data?.length, scrollToBottom]);

    // Se o usuário não está no bottom, preserve a posição exata do scroll quando a lista muda.
    useLayoutEffect(() => {
        const el = messageScrollRef.current;
        if (!el) return;
        if (shouldStickToBottomRef.current) return;

        const anchorId = scrollAnchorMessageIdRef.current;
        if (!anchorId) return;

        const selector = `[data-message-id="${escapeAttrValue(anchorId)}"]`;
        const anchorEl = el.querySelector<HTMLElement>(selector);
        if (!anchorEl) return;

        const containerTop = el.getBoundingClientRect().top;
        const currentOffset = anchorEl.getBoundingClientRect().top - containerTop;
        const desiredOffset = scrollAnchorOffsetPxRef.current;
        const delta = currentOffset - desiredOffset;
        if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) return;
        el.scrollTop += delta;
    }, [escapeAttrValue, messagesQuery.data?.length]);

    if (!channelId && !threadId) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-lg font-semibold">{t("chat:emptyState.title")}</p>
                <p className="text-sm text-muted-foreground">
                    {t("chat:emptyState.subtitle")}
                </p>
            </div>
        );
    }

    if (messagesQuery.isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex h-full">
            <div className="flex flex-1 flex-col px-6 py-4">
                <div className="shrink-0">
                    {threadId && (
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("chat:dm.title", { defaultValue: "Direct Messages" })}
                        </div>
                    )}
                    <h2 className="text-lg font-semibold text-foreground">
                        {header.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{header.subtitle}</p>
                </div>

                <div
                    ref={messageScrollRef}
                    onScroll={handleMessageScroll}
                    className="mt-4 flex-1 overflow-y-auto"
                >
                    <MessageList
                        messages={messagesQuery.data ?? []}
                        currentUserId={currentUserId}
                    />
                    <div ref={messageBottomRef} />
                </div>

                <div className="mt-4 shrink-0">
                    {typingUserIds.length > 0 && (
                        <p className="mb-1 text-xs text-muted-foreground">
                            {typingUserIds.length === 1
                                ? t("chat:composer.typing", {
                                    user: splitDiscordDisplayName(
                                        resolveDisplayName(typingUserIds[0]),
                                    ).name,
                                    defaultValue: "{{user}} is typing",
                                })
                                : t("chat:composer.typingMultiple", {
                                    users: typingUserIds
                                        .map(resolveDisplayName)
                                        .map((dn) => splitDiscordDisplayName(dn).name)
                                        .join(", "),
                                    defaultValue: "{{users}} are typing",
                                })}
                        </p>
                    )}
                    <MessageComposer
                        placeholder={header.placeholder}
                        onSend={async (values) => {
                            await sendMessage.mutateAsync({
                                ...values,
                                client_id: makeClientId(),
                            });
                        }}
                        isSending={sendMessage.isPending}
                        onTyping={sendTyping}
                    />
                </div>
            </div>
            {channelId && <PresencePanel users={presenceQuery.data ?? []} />}
        </div>
    );
};
