"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/providers/auth-provider";
import { MessageList } from "@/components/chat/message-list";
import { MessageComposer } from "@/components/chat/message-composer";
import { PresencePanel } from "@/components/chat/presence-panel";
import type { Channel, Message, PresenceUser } from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";
import { useChannelSocket } from "@/hooks/use-channel-socket";
import { useDmSocket } from "@/hooks/use-dm-socket";
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
  const { apiFetch, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["chat"]);

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
  });

  const presenceQuery = useQuery<PresenceUser[]>({
    queryKey: queryKeys.presence(channelId ?? undefined),
    queryFn: () => apiFetch(`/channels/${channelId}/presence`),
    enabled: !!channelId,
    refetchInterval: 1000 * 30,
  });

  useChannelSocket({
    workspaceId,
    channelId,
    token: accessToken,
    onMessage: (payload) => {
      if (payload.type === "message" && channelId) {
        queryClient.setQueryData<Message[]>(
          queryKeys.channelMessages(channelId),
          (prev: Message[] | undefined) => {
            const list = prev ?? [];
            const exists = list.some(
              (msg: Message) => msg.id === payload.payload.id,
            );
            if (exists) {
              return list;
            }
            return [...list, payload.payload];
          },
        );
      }
    },
  });

  useDmSocket({
    threadId,
    token: accessToken,
    onMessage: (payload) => {
      if (payload.type === "message" && threadId) {
        queryClient.setQueryData<Message[]>(
          queryKeys.threadMessages(threadId),
          (prev: Message[] | undefined) => {
            const list = prev ?? [];
            const exists = list.some(
              (msg: Message) => msg.id === payload.payload.id,
            );
            if (exists) {
              return list;
            }
            return [...list, payload.payload];
          },
        );
      }
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (values: MessageValues) => {
      if (channelId) {
        await apiFetch(`/channels/${channelId}/messages`, {
          method: "POST",
          body: JSON.stringify(values),
        });
      } else if (threadId) {
        await apiFetch(`/dm/threads/${threadId}/messages`, {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
    },
    onSuccess: () => {
      if (channelId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.channelMessages(channelId),
        });
      } else if (threadId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.threadMessages(threadId),
        });
      }
    },
  });

  const title = useMemo(() => {
    if (channelId && channelQuery.data) {
      return `#${channelQuery.data.name}`;
    }
    if (threadId) {
      return t("chat:composer.placeholder", { name: "dm" });
    }
    return t("chat:emptyState.title");
  }, [channelId, channelQuery.data, t, threadId]);

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
      <div className="flex flex-1 flex-col gap-4 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {channelQuery.data?.topic ?? "Messages are synced in realtime"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MessageList messages={messagesQuery.data ?? []} />
        </div>
        <MessageComposer
          placeholder={t("chat:composer.placeholder", { name: title })}
          onSend={(values) => sendMessage.mutateAsync(values)}
          isSending={sendMessage.isPending}
        />
      </div>
      {channelId && <PresencePanel users={presenceQuery.data ?? []} />}
    </div>
  );
};
