"use client";

import { useTranslation } from "react-i18next";

import { ChatView } from "@/components/chat/chat-view";
import { useAppShell } from "@/components/providers/app-shell-provider";

export default function AppIndexPage() {
  const { t } = useTranslation(["chat"]);
  const { activeWorkspaceId, activeChannelId, activeThreadId } = useAppShell();

  if (!activeWorkspaceId || (!activeChannelId && !activeThreadId)) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("chat:emptyState.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("chat:emptyState.subtitle")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ChatView
      workspaceId={activeWorkspaceId}
      channelId={activeChannelId}
      threadId={activeThreadId}
    />
  );
}
