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
  closeLabel,
  onClose,
}: {
  open: boolean;
  variant: SnackbarVariant;
  title?: string;
  message: string;
  progress: number; // 0..1
  fading: boolean;
  closeLabel?: string;
  onClose?: () => void;
}) {
  if (!open) return null;

  const progressClamped = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  const isSuccess = variant === "success";

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 sm:left-auto sm:right-4 sm:-translate-x-0 sm:w-96 sm:max-w-none",
        "pointer-events-none",
      )}
    >
      <div
        role={isSuccess ? "status" : "alert"}
        aria-live={isSuccess ? "polite" : "assertive"}
        className={cn(
          "pointer-events-auto relative overflow-hidden rounded-xl border border-border/60",
          isSuccess
            ? "bg-emerald-600/95 text-white"
            : "bg-destructive/95 text-destructive-foreground",
          "backdrop-blur",
          "shadow-2xl",
          "transition-opacity duration-[800ms]",
          fading ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="px-4 py-3 pr-10">
          {title ? <div className="text-sm font-semibold">{title}</div> : null}
          <div className="mt-0.5 text-sm">{message}</div>
        </div>

        <button
          aria-label={closeLabel ?? "Close"}
          onClick={() => onClose?.()}
          className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/20 text-white hover:bg-black/30"
        >
          ✕
        </button>

        <div className="h-1 w-full bg-border/50">
          <div
            className={cn(
              "h-full w-full",
              isSuccess ? "bg-emerald-500" : "bg-red-700",
              isSuccess ? "origin-left" : "origin-right",
            )}
            style={{ transform: `scaleX(${progressClamped})` }}
          />
        </div>
      </div>
    </div>
  );
}
