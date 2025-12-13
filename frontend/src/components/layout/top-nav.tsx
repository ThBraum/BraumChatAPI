"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { useAppShell } from "@/components/providers/app-shell-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/types";

interface TopNavProps {
    workspaces: Workspace[];
    isLoadingWorkspaces?: boolean;
}

export const TopNav = ({ workspaces, isLoadingWorkspaces }: TopNavProps) => {
    const { activeWorkspaceId, setActiveWorkspaceId } = useAppShell();
    const { t } = useTranslation(["common"]);
    const appName = t("common:appName");

    return (
        <header className="flex flex-col border-b bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/70">
            <div className="flex h-14 items-center justify-between gap-4 px-4">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-lg font-semibold tracking-tight">
                        {appName}
                    </Link>
                    <select
                        className={cn(
                            "hidden rounded-md border border-border bg-background px-3 py-1 text-sm font-medium text-foreground md:block",
                            !activeWorkspaceId && "text-muted-foreground",
                        )}
                        value={activeWorkspaceId ?? ""}
                        onChange={(event) => setActiveWorkspaceId(event.target.value)}
                        disabled={isLoadingWorkspaces}
                    >
                        <option value="" disabled>
                            {t(isLoadingWorkspaces ? "common:loading" : "navigation:selectWorkspace")}
                        </option>
                        {workspaces.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                                {workspace.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-1">
                    <ThemeToggle />
                    <LanguageSwitcher />
                    <UserMenu />
                </div>
            </div>
        </header>
    );
};
