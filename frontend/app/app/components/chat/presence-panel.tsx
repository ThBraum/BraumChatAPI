"use client";

import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { PresenceUser } from "@/lib/types";

interface PresencePanelProps {
  users: PresenceUser[];
}

export const PresencePanel = ({ users }: PresencePanelProps) => {
  const { t } = useTranslation(["chat"]);

  return (
    <aside className="hidden w-64 border-l bg-card/60 p-4 lg:block">
      <h3 className="text-sm font-semibold text-foreground">
        {t("chat:presence.title")}
      </h3>
      <ScrollArea className="mt-4 h-[calc(100vh-6rem)]">
        <ul className="space-y-3">
          {users.map((user) => (
            <li
              key={user.user_id}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-foreground/90">
                {user.display_name ?? user.user_id}
              </span>
              <Badge variant="success">{t("common:status.online")}</Badge>
            </li>
          ))}
          {users.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("chat:presence.empty")}
            </p>
          )}
        </ul>
      </ScrollArea>
    </aside>
  );
};
