"use client";

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { useAppShell } from "@/components/providers/app-shell-provider";
import { queryKeys } from "@/lib/query-keys";
import type { Workspace } from "@/lib/types";

export default function WorkspacesPage() {
  const { apiFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const { activeWorkspaceId, setActiveWorkspaceId } = useAppShell();
  const { t } = useTranslation(["navigation", "common"]);

  const workspacesQuery = useQuery<Workspace[]>({
    queryKey: queryKeys.workspaces,
    queryFn: () => apiFetch("/workspaces"),
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async (payload: { name: string; slug?: string }) => {
      return apiFetch<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (ws) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      setActiveWorkspaceId(ws.id);
    },
  });

  const workspaces = workspacesQuery.data ?? [];

  const handleCreate = () => {
    const name = prompt(t("navigation:workspacesPage.prompts.name"));
    if (!name?.trim()) return;
    const slug = prompt(t("navigation:workspacesPage.prompts.slug"))?.trim();
    createWorkspaceMutation.mutate({
      name: name.trim(),
      slug: slug || undefined,
    });
  };

  const [copied, setCopied] = React.useState(false);
  const inviteUrl =
    typeof window === "undefined" || !user?.display_name
      ? null
      : `${window.location.origin}/register?friend=${encodeURIComponent(user.display_name)}`;

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: best-effort without adding extra UI
      const el = document.createElement("textarea");
      el.value = inviteUrl;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {t("navigation:workspacesPage.title")}
        </h1>
        <Button onClick={handleCreate}>
          {t("navigation:workspacesPage.create")}
        </Button>
      </div>

      {workspacesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
      ) : workspaces.length === 0 ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-lg border border-border/60 bg-card/30 px-6 py-10 text-center">
          <WorkspaceIllustration />
          <div className="space-y-2 max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("navigation:workspacesPage.empty.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("navigation:workspacesPage.empty.subtitle")}
            </p>
          </div>

          <div className="flex w-full max-w-xl flex-col gap-3">
            <Button onClick={handleCreate} className="w-full">
              {t("navigation:workspacesPage.empty.createWorkspace")}
            </Button>

            <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {t("navigation:workspacesPage.empty.inviteLinkTitle", {
                      appName: t("common:appName"),
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("navigation:workspacesPage.empty.inviteLinkSubtitle")}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInviteLink}
                  disabled={!inviteUrl}
                >
                  {copied
                    ? t("navigation:workspacesPage.empty.copied")
                    : t("navigation:workspacesPage.empty.copyInviteLink")}
                </Button>
              </div>
              {inviteUrl && (
                <div className="mt-3">
                  <Input readOnly value={inviteUrl} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {workspaces.map((ws) => (
            <li
              key={ws.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{ws.name}</div>
                {ws.slug && (
                  <div className="truncate text-xs text-muted-foreground">
                    {ws.slug}
                  </div>
                )}
              </div>
              <Button
                variant={
                  activeWorkspaceId === String(ws.id) ? "secondary" : "outline"
                }
                size="sm"
                onClick={() => setActiveWorkspaceId(ws.id)}
              >
                {activeWorkspaceId === String(ws.id)
                  ? t("navigation:workspacesPage.active")
                  : t("navigation:workspacesPage.select")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const WorkspaceIllustration = () => (
  <svg
    width="220"
    height="140"
    viewBox="0 0 220 140"
    role="img"
    aria-label="Workspace empty state"
    className="text-muted-foreground"
  >
    <rect
      x="12"
      y="16"
      width="196"
      height="112"
      rx="14"
      fill="currentColor"
      opacity="0.08"
    />
    <rect
      x="28"
      y="34"
      width="86"
      height="12"
      rx="6"
      fill="currentColor"
      opacity="0.25"
    />
    <rect
      x="28"
      y="56"
      width="164"
      height="10"
      rx="5"
      fill="currentColor"
      opacity="0.18"
    />
    <rect
      x="28"
      y="74"
      width="142"
      height="10"
      rx="5"
      fill="currentColor"
      opacity="0.14"
    />
    <rect
      x="28"
      y="92"
      width="118"
      height="10"
      rx="5"
      fill="currentColor"
      opacity="0.12"
    />
    <circle cx="176" cy="40" r="10" fill="currentColor" opacity="0.25" />
    <circle cx="196" cy="40" r="10" fill="currentColor" opacity="0.18" />
    <path
      d="M176 43.5c2.7 0 5 2.2 5 5v.5h-10v-.5c0-2.8 2.2-5 5-5Zm0-11a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
      fill="currentColor"
      opacity="0.55"
    />
    <path
      d="M196 43.5c2.7 0 5 2.2 5 5v.5h-10v-.5c0-2.8 2.2-5 5-5Zm0-11a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
      fill="currentColor"
      opacity="0.4"
    />
  </svg>
);
