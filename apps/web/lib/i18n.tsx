"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "../messages/en.json";
import zh from "../messages/zh-CN.json";

export type Locale = "en" | "zh-CN";
type LeafKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafKeys<T[K]>}`;
}[keyof T & string];
export type MessageKey = LeafKeys<typeof en>;
export type Translator = (
  key: MessageKey,
  values?: Record<string, string | number | bigint>,
) => string;
const dictionaries: Record<Locale, typeof en> = { en, "zh-CN": zh };
const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
} | null>(null);

function getMessage(locale: Locale, key: MessageKey): string {
  const [domain, item] = key.split(".") as [keyof typeof en, string];
  const dictionary = dictionaries[locale][domain] as Record<string, string>;
  return dictionary[item] ?? key;
}

function browserLocale(): Locale {
  return navigator.languages?.some((value) => /^zh(?:-|$)/i.test(value)) ||
    /^zh(?:-|$)/i.test(navigator.language)
    ? "zh-CN"
    : "en";
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  useEffect(() => {
    const cookie = document.cookie.match(
      /(?:^|;\s*)pactflow_locale=(en|zh-CN)(?:;|$)/,
    )?.[1];
    const saved = window.localStorage.getItem("pactflow_locale");
    if (!cookie)
      updateLocale(
        saved === "en" || saved === "zh-CN" ? saved : browserLocale(),
      );
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = (next: Locale) => {
    updateLocale(next);
    document.cookie = `pactflow_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.localStorage.setItem("pactflow_locale", next);
  };
  const t = useMemo<Translator>(
    () => (key, values) => {
      const template = getMessage(locale, key);
      return template.replace(/\{([^}]+)\}/g, (_, name: string) =>
        String(values?.[name] ?? `{${name}}`),
      );
    },
    [locale],
  );
  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("I18nProvider is missing");
  return context;
}

export function pactStatusLabel(
  status:
    | "Created"
    | "Funded"
    | "Active"
    | "Submitted"
    | "Disputed"
    | "Completed"
    | "Cancelled"
    | "RevisionRequired",
  t: Translator,
) {
  const key = `pact.status${status}` as MessageKey;
  return t(key);
}
export function milestoneStatusLabel(
  status: "Pending" | "Submitted" | "Disputed" | "Paid" | "RevisionRequired",
  t: Translator,
) {
  return t(`milestone.status${status}` as MessageKey);
}
export function verificationModeLabel(
  mode: "ClientOnly" | "AIOnly" | "Hybrid" | "Arbitrator",
  t: Translator,
) {
  const key = {
    ClientOnly: "verification.clientOnly",
    AIOnly: "verification.aiOnly",
    Hybrid: "verification.hybrid",
    Arbitrator: "verification.arbitrator",
  }[mode] as MessageKey;
  return t(key);
}
export function formatDate(timestampMs: number, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
}

export function evidenceTypeLabel(type: string, t: Translator) {
  return t(`evidenceTypes.${type}` as MessageKey);
}
export function processingStatusLabel(status: string, t: Translator) {
  const labels: Record<string, MessageKey> = {
    QUEUED: "v2.processing",
    FETCHING: "verification.progressSecure",
    DETERMINISTIC: "verification.progressRequirements",
    SEMANTIC: "verification.progressRequirements",
    AGGREGATING: "verification.progressProof",
    SIGNING: "verification.progressSigning",
    SUBMITTING: "verification.progressSubmitting",
    ERROR: "v2.error",
  };
  return t(labels[status] ?? "v2.processing");
}
