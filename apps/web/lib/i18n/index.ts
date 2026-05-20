"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import tr from "./dictionaries/tr.json";
import en from "./dictionaries/en.json";

export type Locale = "tr" | "en";

type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Locale, Dictionary> = { tr, en };

export const I18N_STORAGE_KEY = "ayc_lang";
const LANG_EVENT = "ayc:lang-change";

export function normalizeLocale(raw: string | null | undefined): Locale {
  return raw === "en" ? "en" : "tr";
}

export function getTranslation(key: string, locale: Locale): string {
  return DICTIONARIES[locale][key] || DICTIONARIES.tr[key] || key;
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "tr";
  return normalizeLocale(window.localStorage.getItem(I18N_STORAGE_KEY));
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeLocale(locale);
  window.localStorage.setItem(I18N_STORAGE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: normalized }));
}

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>("tr");

  useEffect(() => {
    setLocaleState(getStoredLocale());

    const onStorage = (event: StorageEvent) => {
      if (event.key === I18N_STORAGE_KEY) {
        setLocaleState(normalizeLocale(event.newValue));
      }
    };
    const onLangEvent = (event: Event) => {
      const custom = event as CustomEvent<Locale>;
      setLocaleState(normalizeLocale(custom.detail));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(LANG_EVENT, onLangEvent as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LANG_EVENT, onLangEvent as EventListener);
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    setStoredLocale(normalized);
  }, []);

  const t = useCallback(
    (key: string): string => getTranslation(key, locale),
    [locale],
  );

  return useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );
}
