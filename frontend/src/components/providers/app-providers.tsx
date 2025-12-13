"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";

export const AppProviders = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    return (
        <ThemeProvider>
            <QueryProvider>
                <I18nProvider>
                    <AuthProvider>{children}</AuthProvider>
                </I18nProvider>
            </QueryProvider>
        </ThemeProvider>
    );
};
