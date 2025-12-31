"use client";

import Link from "next/link";
import { Github, Linkedin } from "lucide-react";

import { cn } from "@/lib/utils";

interface SiteFooterProps {
    className?: string;
}

export const SiteFooter = ({ className }: SiteFooterProps) => (
    <footer
        className={cn(
            "flex flex-col gap-2 border-t border-border px-4 py-4 text-[0.7rem] text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
            className,
        )}
    >
        <span className="font-medium tracking-wide text-foreground/80">
            © 2025 Matheus Braum.
        </span>
        <div className="flex items-center gap-3 text-foreground/70">
            <Link
                href="http://github.com/ThBraum"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="transition hover:text-foreground"
            >
                <Github className="h-4 w-4" />
            </Link>
            <Link
                href="http://linkedin.com/in/matheus-thomaz-braum/"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="transition hover:text-foreground"
            >
                <Linkedin className="h-4 w-4" />
            </Link>
        </div>
    </footer>
);
