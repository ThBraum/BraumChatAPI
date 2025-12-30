"use client";

export default function ContactsPage() {
    // Mantém compatibilidade com o link antigo: agora “convidar” fica em /app/direct-messages?tab=invite
    if (typeof window !== "undefined") {
        window.location.replace("/app/direct-messages?tab=invite");
    }
    return null;
}
