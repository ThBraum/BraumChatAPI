"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";

export const useWsToken = (
  enabled: boolean = true,
  minTtlSeconds: number = 60,
) => {
  const { accessToken, getValidAccessToken, logout } = useAuth();
  const [wsToken, setWsToken] = useState<string | null>(null);

  const refreshNow = useCallback(async () => {
    try {
      const next = await getValidAccessToken(minTtlSeconds);
      setWsToken(next);
      if (!next) {
        // Sem token válido: força re-auth em vez de ficar em loop de WS 403.
        await logout();
      }
    } catch {
      setWsToken(null);
      await logout();
    }
  }, [getValidAccessToken, logout, minTtlSeconds]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await refreshNow();
    };

    void run();
    const interval = setInterval(() => {
      void run();
    }, 30_000);

    const onFocus = () => {
      void run();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void run();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [accessToken, enabled, refreshNow]);

  return enabled ? wsToken : null;
};
