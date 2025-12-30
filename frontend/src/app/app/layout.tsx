"use client";

import { AppChrome } from "@/components/layout/app-chrome";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <AppChrome>{children}</AppChrome>
        </ProtectedRoute>
    );
}
