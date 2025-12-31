"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { Snackbar, type SnackbarVariant } from "@/components/ui/snackbar";
import { initI18n } from "@/lib/i18n/config";

type SnackbarPayload = {
    variant: SnackbarVariant;
    title?: string;
    message: string;
};

type SnackbarContextValue = {
    showSnackbar: (payload: SnackbarPayload) => void;
    closeSnackbar?: () => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const TOTAL_MS = 5000;
const FADE_MS = 1000;
const PROGRESS_MS = TOTAL_MS - FADE_MS;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [payload, setPayload] = useState<SnackbarPayload | null>(null);
    const [progress, setProgress] = useState(0);
    const [fading, setFading] = useState(false);

    const rafId = useRef<number | null>(null);
    const fadeTimeoutId = useRef<number | null>(null);
    const closeTimeoutId = useRef<number | null>(null);

    const cleanupTimers = useCallback(() => {
        if (rafId.current != null) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
        }
        if (fadeTimeoutId.current != null) {
            window.clearTimeout(fadeTimeoutId.current);
            fadeTimeoutId.current = null;
        }
        if (closeTimeoutId.current != null) {
            window.clearTimeout(closeTimeoutId.current);
            closeTimeoutId.current = null;
        }
    }, []);

    const closeSnackbar = useCallback(() => {
        cleanupTimers();
        setFading(false);
        setOpen(false);
        setPayload(null);
        setProgress(0);
    }, [cleanupTimers]);

    const showSnackbar = useCallback(
        (next: SnackbarPayload) => {
            cleanupTimers();

            const i18n = initI18n();

            const resolveText = (value?: string) => {
                if (!value) return undefined;

                if (value.includes(":")) return i18n.t(value);

                if (value.startsWith("snackbar.")) return i18n.t(value, { ns: "auth" });

                const translated = i18n.t(value);
                if (translated === value && i18n.exists(value, { ns: "auth" })) {
                    return i18n.t(value, { ns: "auth" });
                }
                return translated;
            };

            const resolvedTitle = resolveText(next.title);
            const resolvedMessage = resolveText(next.message) ?? next.message;

            setPayload({ ...next, title: resolvedTitle, message: resolvedMessage });
            setOpen(true);
            setFading(false);

            const isSuccess = next.variant === "success";
            setProgress(isSuccess ? 0 : 1);

            const start = performance.now();

            const tick = (now: number) => {
                const elapsed = now - start;
                const t = Math.min(1, elapsed / PROGRESS_MS);
                const nextProgress = isSuccess ? t : 1 - t;
                setProgress(nextProgress);

                if (t < 1) {
                    rafId.current = requestAnimationFrame(tick);
                    return;
                }

                setFading(true);
                fadeTimeoutId.current = window.setTimeout(() => {
                    setOpen(false);
                    setPayload(null);
                    setFading(false);
                }, FADE_MS);
            };

            rafId.current = requestAnimationFrame(tick);

            // Safety close in case RAF is throttled.
            closeTimeoutId.current = window.setTimeout(() => {
                setFading(true);
                fadeTimeoutId.current = window.setTimeout(() => {
                    setOpen(false);
                    setPayload(null);
                    setFading(false);
                }, FADE_MS);
            }, PROGRESS_MS);
        },
        [cleanupTimers],
    );

    const value = useMemo(() => ({ showSnackbar, closeSnackbar }), [showSnackbar, closeSnackbar]);

    return (
        <SnackbarContext.Provider value={value}>
            {children}
            <Snackbar
                open={open && !!payload}
                variant={payload?.variant ?? "error"}
                title={payload?.title}
                message={payload?.message ?? ""}
                progress={progress}
                fading={fading}
                onClose={closeSnackbar}
            />
        </SnackbarContext.Provider>
    );
}

export function useSnackbar() {
    const ctx = useContext(SnackbarContext);
    if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
    return ctx;
}
