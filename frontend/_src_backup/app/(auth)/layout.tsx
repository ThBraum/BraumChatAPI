import type { ReactNode } from "react";

import "@/app/globals.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {children}
        </div>
    );
}
