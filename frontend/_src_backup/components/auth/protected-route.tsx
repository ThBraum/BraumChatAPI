"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/providers/auth-provider";

export const ProtectedRoute = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const router = useRouter();
    const { t } = useTranslation(["common"]);
    const { accessToken, isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading && !accessToken) {
            router.replace("/login");
        }
    }, [accessToken, isLoading, router]);

    if (isLoading || !accessToken) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t("common:protected.loading")}</p>
            </div>
        );
    }

    return <>{children}</>;
};
