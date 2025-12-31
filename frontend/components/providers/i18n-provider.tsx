"use client";

import { I18nextProvider } from "react-i18next";
import { useMemo } from "react";

import { initI18n } from "@/lib/i18n/config";

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const i18nInstance = useMemo(() => initI18n(), []);

  return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
};
