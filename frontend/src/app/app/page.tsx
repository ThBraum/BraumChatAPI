"use client";

import { useTranslation } from "react-i18next";

import { ChatView } from "@/components/chat/chat-view";
import { useAppShell } from "@/components/providers/app-shell-provider";

const EmptyState = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
    </div>
);

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
        <ChatView workspaceId={activeWorkspaceId} channelId={activeChannelId} threadId={activeThreadId} />
    );
};

export default function AppHome() {
    return <WorkspaceSurface />;
}
