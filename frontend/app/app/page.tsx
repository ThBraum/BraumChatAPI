"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppIndexPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/app/workspaces");
    }, [router]);

    return null;
}
