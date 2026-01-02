"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import {
  AppShellProvider,
  useAppShell,
} from "@/components/providers/app-shell-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { Snackbar } from "@/components/ui/snackbar";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import { useWsToken } from "@/hooks/use-ws-token";
import type { Thread, Workspace } from "@/lib/types";
import { queryKeys } from "@/lib/query-keys";
import { API_BASE_URL } from "@/lib/utils";

const ShellViewport = ({ children }: { children: React.ReactNode }) => {
  const { apiFetch, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const { activeWorkspaceId, setActiveWorkspaceId } = useAppShell();
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const { t } = useTranslation(["common"]);
  const autoWorkspaceAttemptedRef = useRef(false);
  const wsToken = useWsToken(Boolean(accessToken));

  const [snackbar, setSnackbar] = useState<{
    key: number;
    open: boolean;
    variant: "success" | "error";
    title?: string;
    message: string;
    progress: number;
    fading: boolean;
  }>({
    key: 0,
    open: false,
    variant: "success",
    title: undefined,
    message: "",
    progress: 0,
    fading: false,
  });

  const showSnackbar = useCallback(
    (next: {
      variant: "success" | "error";
      title?: string;
      message: string;
    }) => {
      setSnackbar((prev) => ({
        key: prev.key + 1,
        open: true,
        variant: next.variant,
        title: next.title,
        message: next.message,
        progress: 1,
        fading: false,
      }));
    },
    [],
  );

  useEffect(() => {
    if (!snackbar.open) return;

    const durationMs = 4500;
    const fadeMs = 800;
    const startedAt = Date.now();

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.max(0, 1 - elapsed / durationMs);
      setSnackbar((s) => (s.open ? { ...s, progress: ratio } : s));
    }, 50);

    const timeoutId = window.setTimeout(() => {
      setSnackbar((s) => ({ ...s, progress: 0, fading: true }));
      window.setTimeout(() => {
        setSnackbar((s) => ({ ...s, open: false, fading: false }));
      }, fadeMs);
    }, durationMs);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [snackbar.key, snackbar.open]);

  const { data: workspaces = [], isLoading } = useQuery<Workspace[]>({
    queryKey: queryKeys.workspaces,
    queryFn: () => apiFetch("/workspaces"),
  });

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const res = await fetch(new URL("/health", API_BASE_URL).toString(), {
          method: "GET",
        });
        if (!mounted) return;
        setBackendHealthy(res.ok);
      } catch {
        if (!mounted) return;
        setBackendHealthy(false);
      }
    };

    check();
    const id = setInterval(check, 10000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId && workspaces.length > 0) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, setActiveWorkspaceId, workspaces]);

  useEffect(() => {
    if (autoWorkspaceAttemptedRef.current) return;
    if (isLoading) return;
    if (activeWorkspaceId) return;
    if (workspaces.length > 0) return;

    autoWorkspaceAttemptedRef.current = true;

    (async () => {
      try {
        const suffix =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID().slice(0, 8)
            : String(Date.now());
        const ws = await apiFetch<Workspace>("/workspaces", {
          method: "POST",
          body: JSON.stringify({
            name: t("common:workspaces.defaultName"),
            slug: `personal-${suffix}`,
          }),
        });

        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        setActiveWorkspaceId(ws.id);
      } catch (e) {
        showSnackbar({
          variant: "error",
          message:
            e instanceof Error
              ? t("common:workspaces.autoCreateError", { message: e.message })
              : t("common:workspaces.autoCreateError", { message: String(e) }),
        });
      }
    })();
  }, [
    activeWorkspaceId,
    apiFetch,
    isLoading,
    queryClient,
    setActiveWorkspaceId,
    showSnackbar,
    t,
    workspaces.length,
  ]);

  useNotificationsSocket({
    token: wsToken,
    onMessage: (message) => {
      if (!message || typeof message !== "object") return;
      const typed = message as { type?: string; payload?: unknown };
      const type = typed.type;
      if (!type) return;

      if (type === "dm.unread") {
        const payload = typed.payload as
          | { thread_id?: string | number; delta?: number }
          | undefined;
        const threadId = payload?.thread_id;
        const delta = Number(payload?.delta ?? 1);

        if (threadId != null && Number.isFinite(delta) && delta !== 0) {
          queryClient.setQueriesData<Thread[]>({ queryKey: ["threads", "list"] }, (prev) => {
            const list = prev ?? [];
            let changed = false;
            const next = list.map((t) => {
              if (String(t.id) !== String(threadId)) return t;
              const current = Number(t.unread_count ?? 0);
              const updated = Math.max(0, current + delta);
              if (updated === current) return t;
              changed = true;
              return { ...t, unread_count: updated };
            });
            return changed ? next : list;
          });
        }

        queryClient.invalidateQueries({ queryKey: ["threads", "list"] });
      }
      if (type.startsWith("invite.")) {
        queryClient.invalidateQueries({ queryKey: queryKeys.incomingInvites });
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      }
      if (type.startsWith("friend.")) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.friendRequestsIncoming,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.friendRequestsIncomingPreview,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.friendRequestsOutgoing,
        });
        // friends() inclui query; invalida pelo prefixo
        queryClient.invalidateQueries({ queryKey: ["friends"] });
      }

      if (type === "friend.accepted") {
        const payload = typed.payload as
          | { by?: { display_name?: string } }
          | undefined;
        const byName = payload?.by?.display_name;
        showSnackbar({
          variant: "success",
          message: byName
            ? t("common:notifications.friendAcceptedBy", { name: byName })
            : t("common:notifications.friendAccepted"),
        });
      }
      if (type === "friend.declined") {
        const payload = typed.payload as
          | { by?: { display_name?: string } }
          | undefined;
        const byName = payload?.by?.display_name;
        showSnackbar({
          variant: "error",
          message: byName
            ? t("common:notifications.friendDeclinedBy", { name: byName })
            : t("common:notifications.friendDeclined"),
        });
      }

      if (type === "invite.accepted") {
        const payload = typed.payload as
          | { invitee?: { display_name?: string }; workspace_name?: string }
          | undefined;
        const inviteeName = payload?.invitee?.display_name;
        const workspaceName = payload?.workspace_name;
        showSnackbar({
          variant: "success",
          message:
            inviteeName && workspaceName
              ? t("common:notifications.workspaceInviteAccepted", {
                  name: inviteeName,
                  workspace: workspaceName,
                })
              : t("common:notifications.workspaceInviteAcceptedGeneric"),
        });
      }
      if (type === "invite.declined") {
        const payload = typed.payload as
          | { invitee?: { display_name?: string }; workspace_name?: string }
          | undefined;
        const inviteeName = payload?.invitee?.display_name;
        const workspaceName = payload?.workspace_name;
        showSnackbar({
          variant: "error",
          message:
            inviteeName && workspaceName
              ? t("common:notifications.workspaceInviteDeclined", {
                  name: inviteeName,
                  workspace: workspaceName,
                })
              : t("common:notifications.workspaceInviteDeclinedGeneric"),
        });
      }
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {backendHealthy === false && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm text-center">
          Backend indisponível em {API_BASE_URL} — algumas funcionalidades podem
          falhar.
        </div>
      )}
      <TopNav workspaces={workspaces} isLoadingWorkspaces={isLoading} />
      <Snackbar
        open={snackbar.open}
        variant={snackbar.variant}
        title={snackbar.title}
        message={snackbar.message}
        progress={snackbar.progress}
        fading={snackbar.fading}
        closeLabel={t("common:close")}
        onClose={() =>
          setSnackbar((s) => ({ ...s, open: false, fading: false }))
        }
      />
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <Sidebar workspaces={workspaces} />
        <section className="flex flex-1 flex-col overflow-hidden bg-muted/10">
          <div className="flex-1 overflow-y-auto">{children}</div>
          <SiteFooter className="border-border/80 bg-background/60 px-6" />
        </section>
      </div>
    </div>
  );
};

export const AppChrome = ({ children }: { children: React.ReactNode }) => (
  <AppShellProvider>
    <ShellViewport>{children}</ShellViewport>
  </AppShellProvider>
);
