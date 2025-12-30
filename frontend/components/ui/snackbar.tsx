"use client";

import { cn } from "@/lib/utils";

export type SnackbarVariant = "success" | "error";

export function Snackbar({
    open,
    variant,
    title,
    message,
    progress,
    fading,
}: {
    open: boolean;
    variant: SnackbarVariant;
    title?: string;
    message: string;
    progress: number; // 0..1
    fading: boolean;
}) {
    if (!open) return null;

    const progressClamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const isSuccess = variant === "success";

    return (
        <div
            className={cn(
                "fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 sm:max-w-md",
                "pointer-events-none",
            )}
        >
            <div
                role={isSuccess ? "status" : "alert"}
                aria-live={isSuccess ? "polite" : "assertive"}
                className={cn(
                    "pointer-events-auto overflow-hidden rounded-xl border border-border/60",
                    "bg-card/80 backdrop-blur",
                    "shadow-2xl",
                    "transition-opacity duration-[800ms]",
                    fading ? "opacity-0" : "opacity-100",
                )}
            >
                <div className="px-4 py-3">
                    {title ? <div className="text-sm font-semibold">{title}</div> : null}
                    <div className="mt-0.5 text-sm text-muted-foreground">{message}</div>
                </div>

                <div className="h-1 w-full bg-border/50">
                    <div
                        className={cn(
                            "h-full w-full",
                            isSuccess ? "bg-emerald-500" : "bg-destructive",
                            isSuccess ? "origin-left" : "origin-right",
                        )}
                        style={{ transform: `scaleX(${progressClamped})` }}
                    />
                </div>
            </div>
        </div>
    );
}
