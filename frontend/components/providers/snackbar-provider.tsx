"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { Snackbar, type SnackbarVariant } from "@/components/ui/snackbar";

type SnackbarPayload = {
    variant: SnackbarVariant;
    title?: string;
    message: string;
};

type SnackbarContextValue = {
    showSnackbar: (payload: SnackbarPayload) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const TOTAL_MS = 4500;
const FADE_MS = 800; // < 1s
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

    const showSnackbar = useCallback(
        (next: SnackbarPayload) => {
            cleanupTimers();

            setPayload(next);
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

    const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);

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
            />
        </SnackbarContext.Provider>
    );
}

export function useSnackbar() {
    const ctx = useContext(SnackbarContext);
    if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
    return ctx;
}
