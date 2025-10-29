"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, locales } from './config';

// Import translation files
import enMessages from '../../messages/en.json';
import zhMessages from '../../messages/zh.json';
import jaMessages from '../../messages/ja.json';
import koMessages from '../../messages/ko.json';

const messages = {
  en: enMessages,
  zh: zhMessages,
  ja: jaMessages,
  ko: koMessages,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    // Load saved locale from localStorage
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && locales.includes(savedLocale)) {
      setLocale(savedLocale);
    }
  }, []);

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = messages[locale];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function useTranslations(namespace: string) {
  const { t } = useI18n();
  return (key: string, values?: Record<string, string | number>) => {
    let translation = t(`${namespace}.${key}`);
    
    // Replace placeholders if values are provided
    if (values) {
      Object.entries(values).forEach(([placeholder, value]) => {
        translation = translation.replace(`{${placeholder}}`, String(value));
      });
    }
    
    return translation;
  };
}

export function useLocale() {
  const { locale } = useI18n();
  return locale;
}
