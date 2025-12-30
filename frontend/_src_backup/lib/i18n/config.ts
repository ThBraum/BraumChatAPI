"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "@/locales/en/common.json";
import enAuth from "@/locales/en/auth.json";
import enChat from "@/locales/en/chat.json";
import enNav from "@/locales/en/navigation.json";
import enProfile from "@/locales/en/profile.json";

import ptCommon from "@/locales/pt-BR/common.json";
import ptAuth from "@/locales/pt-BR/auth.json";
import ptChat from "@/locales/pt-BR/chat.json";
import ptNav from "@/locales/pt-BR/navigation.json";
import ptProfile from "@/locales/pt-BR/profile.json";
import esCommon from "@/locales/es/common.json";
import esAuth from "@/locales/es/auth.json";
import esChat from "@/locales/es/chat.json";
import esNav from "@/locales/es/navigation.json";
import esProfile from "@/locales/es/profile.json";

import frCommon from "@/locales/fr/common.json";
import frAuth from "@/locales/fr/auth.json";
import deCommon from "@/locales/de/common.json";
import deAuth from "@/locales/de/auth.json";
import zhCommon from "@/locales/zh/common.json";
import zhAuth from "@/locales/zh/auth.json";

// Placeholder resources for languages we have not localized yet reuse English strings
const sharedChat = enChat;
const sharedNav = enNav;
const sharedProfile = enProfile;

export const defaultNS = "common";

const resources = {
	en: {
		common: enCommon,
		auth: enAuth,
		chat: enChat,
		navigation: enNav,
		profile: enProfile,
	},
	"pt-BR": {
		common: ptCommon,
		auth: ptAuth,
		chat: ptChat,
		navigation: ptNav,
		profile: ptProfile,
	},
	es: {
		common: esCommon,
		auth: esAuth,
		chat: esChat,
		navigation: esNav,
		profile: esProfile,
	},
	fr: {
		common: frCommon,
		auth: frAuth,
		chat: sharedChat,
		navigation: sharedNav,
		profile: sharedProfile,
	},
	de: {
		common: deCommon,
		auth: deAuth,
		chat: sharedChat,
		navigation: sharedNav,
		profile: sharedProfile,
	},
	zh: {
		common: zhCommon,
		auth: zhAuth,
		chat: sharedChat,
		navigation: sharedNav,
		profile: sharedProfile,
	},
} as const;

export const supportedLngs = Object.keys(resources);

export const initI18n = () => {
	if (!i18n.isInitialized) {
		i18n
			.use(LanguageDetector)
			.use(initReactI18next)
			.init({
				resources,
				fallbackLng: "en",
				lng: "en",
				ns: Object.keys(resources.en),
				defaultNS,
				supportedLngs,
				detection: {
					order: ["localStorage", "navigator"],
					caches: ["localStorage"],
				},
				interpolation: { escapeValue: false },
			})
			.catch((error: unknown) => {
				console.error("i18n init error", error);
			});
	}
	return i18n;
};
