import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim() ||
  "http://localhost:8000";

export const STORAGE_KEYS = {
  accessToken: "chattingwork.accessToken",
  refreshToken: "chattingwork.refreshToken",
};

export const toWsUrl = (path: string) => {
  let base: URL;
  try {
    base = new URL(API_BASE_URL);
  } catch {
    base = new URL("http://localhost:8000");
  }

  const url = new URL(path, base);
  url.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

export const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const getInitials = (value: string) => {
  if (!value) return "?";
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};
