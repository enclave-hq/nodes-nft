"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, defaultLocale } from './config';
import enMessages from '@/messages/en.json';
import zhMessages from '@/messages/zh.json';
import jaMessages from '@/messages/ja.json';
import koMessages from '@/messages/ko.json';

const messages = {
  en: enMessages,
  zh: zhMessages,
  ja: jaMessages,
  ko: koMessages,
};

type Messages = typeof enMessages;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // Load locale from localStorage on mount
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'zh' || savedLocale === 'ja' || savedLocale === 'ko')) {
      setLocaleState(savedLocale);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = messages[locale];

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== 'string') {
      return key; // Return key if translation not found
    }

    // Replace parameters
    if (params) {
      return Object.entries(params).reduce(
        (text, [param, val]) => text.replace(`{${param}}`, String(val)),
        value
      );
    }

    return value;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

// Alias for convenience
export const useTranslations = (namespace: string) => {
  const { t } = useI18n();
  return (key: string, params?: Record<string, string | number>) => {
    return t(`${namespace}.${key}`, params);
  };
};

export const useLocale = () => {
  const { locale } = useI18n();
  return locale;
};


