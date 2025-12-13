"use client";

import { useTranslation } from "react-i18next";

import { AppChrome } from "@/components/layout/app-chrome";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ChatView } from "@/components/chat/chat-view";
import { useAppShell } from "@/components/providers/app-shell-provider";

const WorkspaceSurface = () => {
  const { t } = useTranslation(["chat"]);
  const { activeWorkspaceId, activeChannelId, activeThreadId } = useAppShell();

  if (!activeWorkspaceId) {
    return <EmptyState title={t("chat:emptyState.title")} subtitle={t("chat:emptyState.subtitle")} />;
  }

  if (!activeChannelId && !activeThreadId) {
    return <EmptyState title={t("chat:emptyState.title")} subtitle={t("chat:emptyState.subtitle")} />;
  }

  return (
    <ChatView
      workspaceId={activeWorkspaceId}
      channelId={activeChannelId}
      threadId={activeThreadId}
    />
  );
};

const EmptyState = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
    <div className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

export default function Home() {
  return (
    <ProtectedRoute>
      <AppChrome>
        <WorkspaceSurface />
      </AppChrome>
    </ProtectedRoute>
  );
}
