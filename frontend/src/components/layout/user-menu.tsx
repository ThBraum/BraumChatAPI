"use client";

import Link from "next/link";
import { LogOut, MonitorCog, UserCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/providers/auth-provider";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

export const UserMenu = () => {
    const { user, logout } = useAuth();
    const { t } = useTranslation(["navigation"]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.display_name} />
                        <AvatarFallback>{getInitials(user?.display_name ?? "")}</AvatarFallback>
                    </Avatar>
                    <div className="hidden flex-col text-left text-sm leading-tight sm:flex">
                        <span className="font-medium">{user?.display_name ?? "User"}</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user?.display_name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2">
                        <UserCircle2 className="h-4 w-4" />
                        {t("navigation:profile")}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/sessions" className="flex items-center gap-2">
                        <MonitorCog className="h-4 w-4" />
                        {t("navigation:sessions")}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                    <button
                        type="button"
                        onClick={() => logout().catch(() => undefined)}
                        className="flex w-full items-center gap-2 text-left"
                    >
                        <LogOut className="h-4 w-4" />
                        {t("navigation:logout")}
                    </button>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
