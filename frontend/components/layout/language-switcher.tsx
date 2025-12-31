"use client";

import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const LANGUAGES = [
  { code: "en", label: "English", short: "EN(US)", flag: "🇺🇸" },
  { code: "pt-BR", label: "Português", short: "PT(BR)", flag: "🇧🇷" },
  { code: "es", label: "Español", short: "ES", flag: "🇪🇸" },
  { code: "fr", label: "Français", short: "FR", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", short: "DE", flag: "🇩🇪" },
  { code: "zh", label: "中文", short: "中文", flag: "🇨🇳" },
];

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const active =
    LANGUAGES.find(
      (lang) =>
        i18n.language === lang.code || i18n.language.startsWith(lang.code),
    ) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-2 text-foreground hover:bg-accent sm:gap-2 sm:px-3"
        >
          <span className="text-lg" aria-hidden>
            {active.flag}
          </span>
          <span className="hidden text-xs font-semibold uppercase tracking-wide text-foreground/80 sm:block">
            {active.short}
          </span>
          <ChevronDown className="h-3 w-3 text-foreground/60" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-2xl border border-border bg-popover text-sm text-popover-foreground"
      >
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`flex items-center justify-between gap-4 rounded-xl px-3 py-2 ${
              i18n.language === lang.code ? "bg-accent font-semibold" : ""
            }`}
          >
            <span>{lang.label}</span>
            <span className="text-lg" aria-hidden>
              {lang.flag}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
