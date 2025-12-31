"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";

import { STORAGE_KEYS } from "@/lib/utils";
import { type ApiRequestOptions, buildUrl, parseJson } from "@/lib/api-client";
import type { AuthTokens, User } from "@/lib/types";

interface AuthContextValue {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isLoading: boolean;
    getValidAccessToken: (minTtlSeconds?: number) => Promise<string | null>;
    login: (
        payload: { email: string; password: string },
        options?: {
            redirectTo?: string;
            friendInviteDisplayName?: string;
        },
    ) => Promise<void>;
    register: (
        payload: {
        email: string;
        password: string;
        display_name: string;
        },
        options?: {
            redirectTo?: string;
            friendInviteDisplayName?: string;
        },
    ) => Promise<void>;
    logout: () => Promise<void>;
    apiFetch: <T>(path: string, options?: ApiRequestOptions) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const decodeJwtExp = (token: string): number | null => {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        let payloadB64 = parts[1] ?? "";
        payloadB64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
        const pad = (4 - (payloadB64.length % 4)) % 4;
        if (pad) payloadB64 += "=".repeat(pad);

        const payloadJson = atob(payloadB64);
        const payload = JSON.parse(payloadJson) as { exp?: number };
        return typeof payload.exp === "number" ? payload.exp : null;
    } catch {
        return null;
    }
};

const storeTokens = (tokens: AuthTokens | null) => {
    if (!tokens) {
        localStorage.removeItem(STORAGE_KEYS.accessToken);
        localStorage.removeItem(STORAGE_KEYS.refreshToken);
        return;
    }
    localStorage.setItem(STORAGE_KEYS.accessToken, tokens.access_token);
    localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refresh_token);
};

const readTokens = () => ({
    access: typeof window === "undefined"
        ? null
        : localStorage.getItem(STORAGE_KEYS.accessToken),
    refresh: typeof window === "undefined"
        ? null
        : localStorage.getItem(STORAGE_KEYS.refreshToken),
});

export const AuthProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const refreshPromise = useRef<Promise<AuthTokens | null> | null>(null);

    useEffect(() => {
        const tokens = readTokens();
        if (tokens.access && tokens.refresh) {
            setAccessToken(tokens.access);
            setRefreshToken(tokens.refresh);
            void fetchProfile(tokens.access);
        } else {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setTokens = useCallback((tokens: AuthTokens | null) => {
        if (!tokens) {
            storeTokens(null);
            setAccessToken(null);
            setRefreshToken(null);
            return;
        }
        storeTokens(tokens);
        setAccessToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
    }, []);

    const fetchProfile = useCallback(
        async (token?: string) => {
            if (!token && !accessToken) return;
            try {
                const response = await fetch(buildUrl("/auth/me"), {
                    headers: {
                        Authorization: `Bearer ${token ?? accessToken}`,
                    },
                    cache: "no-store",
                });
                if (response.status === 401) {
                    setUser(null);
                    setTokens(null);
                    return;
                }

                if (!response.ok) {
                    setUser(null);
                    return;
                }

                const profile = await response.json();
                setUser(profile);
            } catch (err) {
                console.error("Unable to fetch profile", err);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        },
        [accessToken, setTokens],
    );

    const refreshSession = useCallback(async () => {
        if (!refreshToken) return null;
        if (!refreshPromise.current) {
            refreshPromise.current = (async () => {
                try {
                    const response = await fetch(buildUrl("/auth/refresh"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ refresh_token: refreshToken }),
                    });
                    if (!response.ok) {
                        setTokens(null);
                        setUser(null);
                        return null;
                    }

                    const tokens = (await response.json()) as AuthTokens;
                    if (!tokens?.access_token || !tokens?.refresh_token) {
                        setTokens(null);
                        setUser(null);
                        return null;
                    }
                    setTokens(tokens);
                    return tokens;
                } catch {
                    setTokens(null);
                    setUser(null);
                    return null;
                }
            })().finally(() => {
                refreshPromise.current = null;
            });
        }
        return refreshPromise.current;
    }, [refreshToken, setTokens]);

    const getValidAccessToken = useCallback(
        async (minTtlSeconds: number = 60) => {
            if (!accessToken) return null;
            const exp = decodeJwtExp(accessToken);
            if (!exp) return accessToken;
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (exp - nowSeconds > minTtlSeconds) return accessToken;

            const refreshed = await refreshSession();
            return refreshed?.access_token ?? null;
        },
        [accessToken, refreshSession],
    );

    const logout = useCallback(async () => {
        setTokens(null);
        setUser(null);
        router.push("/login");
    }, [router, setTokens]);

    const handleRequest = useCallback(
        async <T,>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
            const { params, method = "GET", headers, body, ...rest } = options;

            const run = async (tokenOverride?: string): Promise<T> => {
                const requestHeaders = new Headers(headers ?? undefined);
                if (!requestHeaders.has("Content-Type")) {
                    requestHeaders.set("Content-Type", "application/json");
                }
                const tokenToUse = tokenOverride ?? accessToken;
                if (tokenToUse) {
                    requestHeaders.set("Authorization", `Bearer ${tokenToUse}`);
                }

                const response = await fetch(buildUrl(path, params), {
                    method,
                    body,
                    ...rest,
                    headers: requestHeaders,
                });

                if (response.status === 401 && refreshToken) {
                    const refreshed = await refreshSession();
                    if (refreshed?.access_token) {
                        return run(refreshed.access_token);
                    }
                    await logout();
                    throw new Error("Session expired");
                }

                if (!response.ok) {
                    const message = (await response.text()) || "Request failed";
                    throw new Error(message);
                }

                return parseJson<T>(response);
            };

            return run();
        },
        [accessToken, logout, refreshSession, refreshToken],
    );

    const login = useCallback(
        async (
            payload: { email: string; password: string },
            options?: { redirectTo?: string; friendInviteDisplayName?: string },
        ) => {
            const form = new URLSearchParams();
            // FastAPI OAuth2PasswordRequestForm expects form fields: username/password (+ optional OAuth2 fields)
            form.set("grant_type", "password");
            form.set("username", payload.email);
            form.set("password", payload.password);
            form.set("scope", "");
            form.set("client_id", "");
            form.set("client_secret", "");

            const response = await fetch(buildUrl("/auth/login"), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: form.toString(),
            });
            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || "Invalid credentials");
            }
            const tokens = (await response.json()) as AuthTokens;
            setTokens(tokens);
            await fetchProfile(tokens.access_token);

            if (options?.friendInviteDisplayName) {
                try {
                    await fetch(buildUrl("/friends/requests"), {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${tokens.access_token}`,
                        },
                        body: JSON.stringify({
                            addressee_display_name: options.friendInviteDisplayName,
                        }),
                    });
                } catch (err) {
                    console.warn("Unable to send friend invite after signup/login", err);
                }
            }

            router.push(options?.redirectTo ?? "/app");
        },
        [fetchProfile, router, setTokens],
    );

    const register = useCallback(
        async (
            payload: { email: string; password: string; display_name: string },
            options?: { redirectTo?: string; friendInviteDisplayName?: string },
        ) => {
            const response = await fetch(buildUrl("/auth/register"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || "Unable to register");
            }
            await login({ email: payload.email, password: payload.password }, options);
        },
        [login],
    );

    const value = useMemo(
        () => ({
            user,
            accessToken,
            refreshToken,
            isLoading,
            getValidAccessToken,
            login,
            register,
            logout,
            apiFetch: handleRequest,
        }),
        [
            user,
            accessToken,
            refreshToken,
            isLoading,
            getValidAccessToken,
            login,
            register,
            logout,
            handleRequest,
        ],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};
