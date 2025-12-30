"use client";

import { Fragment, useMemo } from "react";
import { format } from "date-fns";

import type { Message } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
}

const groupByDay = (messages: Message[]) => {
  const groups: Record<string, Message[]> = {};
  messages.forEach((message) => {
    const day = format(new Date(message.created_at), "yyyy-MM-dd");
    groups[day] = groups[day] ? [...groups[day], message] : [message];
  });
  return groups;
};

export const MessageList = ({ messages }: MessageListProps) => {
  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([day, dayMessages]) => (
        <Fragment key={day}>
          <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {format(new Date(day), "EEEE, MMM d")}
          </div>
          <ul className="space-y-4">
            {dayMessages.map((message) => (
              <li key={message.id} className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{getInitials(message.author.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {message.author.display_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(message.created_at), "HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90">{message.content}</p>
                </div>
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </div>
  );
};
