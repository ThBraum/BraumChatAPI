"use client";

import { useEffect } from "react";

const STORAGE_KEY = "chattingwork.geo.prompted.v1";

export const LocationBootstrap = () => {
    useEffect(() => {
        // Evita reprompt em toda navegação.
        try {
            if (localStorage.getItem(STORAGE_KEY) === "1") return;
            localStorage.setItem(STORAGE_KEY, "1");
        } catch {
            // ignore
        }

        if (typeof navigator === "undefined") return;
        if (!("geolocation" in navigator)) return;

        // Apenas para solicitar permissão ao iniciar (hora/timezone já vem do dispositivo).
        navigator.geolocation.getCurrentPosition(
            () => {
                // ignore
            },
            () => {
                // ignore
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 1000 * 60 * 60 },
        );
    }, []);

    return null;
};
