"use client";

import { Fragment, useMemo } from "react";
import { format } from "date-fns";

import type { Message } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  currentUserId?: string | null;
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

const groupByDay = (messages: Message[]) => {
  const sorted = [...messages].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id).localeCompare(String(b.id));
  });

  const groups: Record<string, Message[]> = {};
  sorted.forEach((message) => {
    const day = format(new Date(message.created_at), "yyyy-MM-dd");
    groups[day] = groups[day] ? [...groups[day], message] : [message];
  });
  return groups;
};

export const MessageList = ({ messages, currentUserId }: MessageListProps) => {
  const grouped = useMemo(() => groupByDay(messages), [messages]);

  const orderedDays = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  }, [grouped]);

  return (
    <div className="space-y-8">
      {orderedDays.map((day) => (
        <Fragment key={day}>
          <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {format(new Date(day), "EEEE, MMM d")}
          </div>
          <ul className="space-y-4">
            {(grouped[day] ?? []).map((message) => {
              const isOwn =
                currentUserId != null &&
                String(message.user_id) === String(currentUserId);

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
                      {getInitials(getMessageAuthorDisplayName(message))}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "min-w-0 flex-1",
                      isOwn
                        ? "flex flex-col items-end text-right"
                        : "text-left",
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
                        {getMessageAuthorDisplayName(message)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "HH:mm")}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm text-foreground/90",
                        "break-words",
                      )}
                    >
                      {message.content}
                    </p>
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
