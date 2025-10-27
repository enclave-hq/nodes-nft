export const locales = ['en', 'zh', 'ja', 'ko'] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
};

export const defaultLocale: Locale = 'en';


