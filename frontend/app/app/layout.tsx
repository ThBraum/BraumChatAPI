"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppChrome } from "@/components/layout/app-chrome";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppChrome>{children}</AppChrome>
    </ProtectedRoute>
  );
}
