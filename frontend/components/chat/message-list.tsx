"use client";

import { Fragment, useMemo } from "react";
import { CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Message } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  currentUserId?: string | null;
  otherLastReadMessageId?: number | null;
}

type AuthorLike = { display_name?: string | null };

const getMessageAuthorDisplayName = (message: Message): string => {
  const maybe = message as unknown as {
    author?: AuthorLike;
    user?: AuthorLike;
    sender?: AuthorLike;
  };

  return (
    maybe.author?.display_name ??
    maybe.user?.display_name ??
    maybe.sender?.display_name ??
    "Unknown"
  );
};

const splitDiscordCode = (displayName: string) => {
  const idx = displayName.lastIndexOf("#");
  if (idx <= 0 || idx >= displayName.length - 1) return { name: displayName, code: null as string | null };

  const code = displayName.slice(idx + 1);
  // Heurística: tratamos como "código" se for numérico (ex: 2335).
  if (!/^[0-9]{3,}$/.test(code)) return { name: displayName, code: null as string | null };

  return { name: displayName.slice(0, idx), code: `#${code}` };
};

const toLocalDayKey = (value: string) => {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const hashStringToIndex = (value: string, modulo: number) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % Math.max(1, modulo);
};

const bubbleBgByUserId = (userId: string) => {
  const palette = [
    "bg-muted/40",
    "bg-accent/30",
    "bg-secondary/40",
    "bg-muted/30",
  ] as const;
  return palette[hashStringToIndex(userId, palette.length)];
};

const groupByDay = (messages: Message[]) => {
  const sorted = [...messages].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id).localeCompare(String(b.id));
  });

  const groups: Record<string, Message[]> = {};
  sorted.forEach((message) => {
    const day = toLocalDayKey(message.created_at);
    groups[day] = groups[day] ? [...groups[day], message] : [message];
  });
  return groups;
};

export const MessageList = ({
  messages,
  currentUserId,
  otherLastReadMessageId,
}: MessageListProps) => {
  const { i18n } = useTranslation();
  const locale = i18n.language || undefined;
  const grouped = useMemo(() => groupByDay(messages), [messages]);

  const lastOwnNumericMessageId = useMemo(() => {
    if (!currentUserId) return null;
    let maxId = 0;
    for (const message of messages) {
      if (String(message.user_id) !== String(currentUserId)) continue;
      const id = Number(message.id);
      if (Number.isInteger(id) && id > maxId) maxId = id;
    }
    return maxId > 0 ? maxId : null;
  }, [currentUserId, messages]);

  const orderedDays = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  }, [grouped]);

  return (
    <div className="space-y-8">
      {orderedDays.map((day) => (
        <Fragment key={day}>
          <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {new Intl.DateTimeFormat(locale, {
              weekday: "long",
              month: "short",
              day: "numeric",
            }).format(new Date(`${day}T00:00:00`))}
          </div>
          <ul className="space-y-4">
            {(grouped[day] ?? []).map((message) => {
              const isOwn =
                currentUserId != null &&
                String(message.user_id) === String(currentUserId);

              const rawDisplayName = getMessageAuthorDisplayName(message);
              const authorName = splitDiscordCode(rawDisplayName).name;
              const authorId = String(message.user_id ?? "unknown");
              const bubbleBg = isOwn ? "bg-primary/10" : bubbleBgByUserId(authorId);

              const numericId = Number(message.id);
              const showReadReceipt =
                isOwn &&
                otherLastReadMessageId != null &&
                lastOwnNumericMessageId != null &&
                Number.isInteger(numericId) &&
                numericId === lastOwnNumericMessageId &&
                otherLastReadMessageId >= lastOwnNumericMessageId;

              return (
                <li
                  key={message.id}
                  data-message-id={String(message.id)}
                  className={cn(
                    "flex gap-3",
                    isOwn ? "flex-row-reverse justify-end" : "justify-start",
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {getInitials(authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "min-w-0 flex-1",
                      isOwn
                        ? "flex flex-col items-end"
                        : "flex flex-col items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2",
                        isOwn
                          ? "flex-row-reverse justify-end"
                          : "justify-start",
                      )}
                    >
                      <span className="text-sm font-semibold text-foreground">
                        {authorName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(message.created_at))}
                      </span>
                      {showReadReceipt && (
                        <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "mt-1 w-fit max-w-[48%] rounded-2xl px-3 py-2 text-left",
                        "border border-border/50",
                        bubbleBg,
                      )}
                    >
                      <p className={cn("text-sm text-foreground/90", "break-words")}>
                        {message.content}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Fragment>
      ))}
    </div>
  );
};
