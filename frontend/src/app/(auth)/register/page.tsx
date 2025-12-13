"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
    const formRef = useRef<HTMLFormElement | null>(null);
    const { register: registerUser } = useAuth();
    const router = useRouter();
    const { t } = useTranslation(["auth", "common"]);

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const highlights = t("auth:hero.highlights", {
        returnObjects: true,
    }) as string[];

    const languagesDetail = t("auth:hero.stats.languagesDetail");
    const appName = t("common:appName");

    const stats = [
        { value: "4.2k+", label: t("auth:hero.stats.teams") },
        { value: "99.95%", label: t("auth:hero.stats.uptime") },
        { value: "6", label: t("auth:hero.stats.languages"), detail: languagesDetail },
    ];

    const scrollToForm = () => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        formRef.current?.querySelector("input")?.focus();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        setSuccess(null);
        // Validate required fields
        if (!displayName?.trim() || !email?.trim() || !password || !confirmPassword) {
            setError(t("auth:register.requiredFields") ?? "All fields are required");
            setIsSubmitting(false);
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError(t("auth:register.invalidEmail") ?? "Invalid email format");
            setIsSubmitting(false);
            return;
        }

        // Validate password match
        if (password !== confirmPassword) {
            setError(t("auth:register.passwordMismatch") ?? "Passwords do not match");
            setIsSubmitting(false);
            return;
        }

        setError(null);
        try {
            await registerUser({
                email,
                password,
                display_name: displayName,
            });
            setSuccess(t("auth:register.success") ?? "Account created! Redirecting...");
            setConfirmPassword("");
            // Após sucesso, vai direto para a tela principal
            router.push("/");
        } catch (err) {
            setError((err as Error)?.message ?? t("auth:login.error") ?? "Register failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0 opacity-70">
                <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-indigo-500/40 blur-3xl" />
                <div className="absolute top-24 -left-20 h-64 w-64 rounded-full bg-sky-400/30 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-purple-500/30 blur-3xl" />
                <div className="absolute inset-x-10 top-1/3 h-24 bg-[radial-gradient(circle,_rgba(255,255,255,0.18)_1px,_transparent_1px)] bg-[length:22px_22px]" />
                <div className="absolute top-1/4 right-12 h-16 w-16 bg-amber-300/40 [clip-path:polygon(50%_0%,0%_100%,100%_100%)]" />
                <div className="absolute bottom-16 left-16 grid grid-cols-4 gap-3 opacity-60">
                    {Array.from({ length: 12 }).map((_, index) => (
                        <span key={index} className="h-2 w-2 rounded-full bg-white/40" />
                    ))}
                </div>
            </div>

            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="flex items-center justify-between px-6 py-6 lg:px-12">
                    <div>
                        <p className="text-sm uppercase tracking-[0.4em] text-slate-300">
                            {t("auth:hero.eyebrow")}
                        </p>
                        <p className="text-lg font-semibold text-white">{appName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <Button variant="ghost" className="text-white hover:text-primary" onClick={scrollToForm}>
                            {t("auth:hero.actions.signup")}
                        </Button>
                        <Button className="bg-primary px-4" onClick={() => router.push("/login")}>
                            {t("auth:hero.actions.login")}
                        </Button>
                    </div>
                </header>

                <main className="flex flex-1 flex-col gap-10 px-6 pb-10 lg:grid lg:grid-cols-[1.15fr,0.85fr] lg:items-center lg:px-12">
                    <section className="space-y-8 text-slate-100">
                        <div className="space-y-4">
                            <p className="inline-flex items-center rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.4em] text-slate-300">
                                {t("auth:hero.aboutLabel")}
                            </p>
                            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
                                {t("auth:hero.title")}
                            </h1>
                            <p className="max-w-2xl text-base text-slate-300 md:text-lg">
                                {t("auth:hero.description")}
                            </p>
                        </div>

                        <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:grid-cols-2">
                            <div className="space-y-3 min-w-0">
                                <h2 className="text-xl font-semibold text-white">{t("auth:hero.aboutTitle")}</h2>
                                <p className="text-sm text-slate-200">{t("auth:hero.aboutBody")}</p>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    {highlights?.map((item) => (
                                        <li key={item} className="flex items-start gap-2">
                                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="grid gap-4 min-w-0 sm:grid-cols-3">
                                {stats.map((stat) => {
                                    const hasDetail = Boolean(stat.detail);
                                    const cardClasses = `rounded-2xl border border-white/10 bg-white/5 p-6 text-center flex flex-col items-center justify-center min-h-[5.25rem] w-full overflow-hidden ${hasDetail
                                        ? "max-w-full md:max-w-[14rem] lg:max-w-[20rem]"
                                        : "max-w-full md:max-w-[11rem] lg:max-w-[14rem]"
                                        }`;
                                    const numberClasses = `${hasDetail ? "text-lg md:text-xl lg:text-2xl" : "text-xl md:text-2xl lg:text-3xl"} font-semibold text-white leading-tight max-w-full break-words`;

                                    return (
                                        <div key={stat.label} className={cardClasses}>
                                            <p className={numberClasses}>{stat.value}</p>
                                            <p className="mt-3 text-sm text-slate-300">{stat.label}</p>
                                            {stat.detail && (
                                                <p className="mt-2 text-xs text-slate-400 whitespace-normal text-left">{stat.detail}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <section>
                        <Card className="border-white/10 bg-slate-950/70 shadow-2xl backdrop-blur">
                            <CardHeader className="space-y-2">
                                <CardTitle className="text-3xl text-white">{t("auth:register.title")}</CardTitle>
                                <p className="text-sm text-slate-300">{t("auth:register.subtitle")}</p>
                            </CardHeader>
                            <CardContent>
                                <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                                    {error && <p className="text-sm text-destructive">{error}</p>}
                                    {success && (
                                        <div className="text-sm text-emerald-400 font-semibold">
                                            {success}
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="displayName" className="inline-flex items-center gap-1">
                                            {t("auth:register.displayName")}
                                            <span className="sr-only"> {t("auth:register.requiredField") ?? "required"}</span>
                                        </Label>
                                        <Input
                                            id="displayName"
                                            value={displayName}
                                            onChange={(event) => setDisplayName(event.target.value)}
                                            required
                                            aria-required="true"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="inline-flex items-center gap-1">
                                            {t("auth:login.email")}
                                            <span className="sr-only"> {t("auth:register.requiredField") ?? "required"}</span>
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            required
                                            aria-required="true"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="inline-flex items-center gap-1">
                                            {t("auth:login.password")}
                                            <span className="sr-only"> {t("auth:register.requiredField") ?? "required"}</span>
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                autoComplete="new-password"
                                                value={password}
                                                onChange={(event) => setPassword(event.target.value)}
                                                required
                                                aria-required="true"
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-200"
                                                onClick={() => setShowPassword((prev) => !prev)}
                                                aria-label={showPassword ? t("auth:register.hidePassword") ?? "Hide password" : t("auth:register.showPassword") ?? "Show password"}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword" className="inline-flex items-center gap-1">
                                            {t("auth:register.confirmPassword")}
                                            <span className="sr-only"> {t("auth:register.requiredField") ?? "required"}</span>
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                autoComplete="new-password"
                                                value={confirmPassword}
                                                onChange={(event) => setConfirmPassword(event.target.value)}
                                                required
                                                aria-required="true"
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-200"
                                                onClick={() => setShowConfirmPassword((prev) => !prev)}
                                                aria-label={showConfirmPassword ? t("auth:register.hidePassword") ?? "Hide password" : t("auth:register.showPassword") ?? "Show password"}
                                            >
                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                                        {isSubmitting ? t("auth:register.creating") : t("auth:register.submit")}
                                    </Button>
                                    <p className="text-center text-sm text-slate-400">
                                        {t("auth:register.hint")} {" "}
                                        <button
                                            type="button"
                                            onClick={() => router.push("/login")}
                                            className="font-semibold text-primary hover:underline"
                                        >
                                            {t("auth:register.cta")}
                                        </button>
                                    </p>
                                </form>
                            </CardContent>
                        </Card>
                    </section>
                </main>
                <SiteFooter className="border-white/10 px-6 text-slate-400 lg:px-12" />
            </div>
        </div>
    );
}
