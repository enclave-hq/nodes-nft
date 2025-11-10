"use client";

import { useI18n } from '@/lib/i18n/provider';
import { locales, localeNames, Locale } from '@/lib/i18n/config';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from '@/lib/i18n/provider';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const t = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-x-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-100 transition-colors"
        aria-label={t('selectLanguage')}
      >
        <Globe className="h-4 w-4" />
        <span>{localeNames[locale]}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-40 rounded-md bg-[#FFFFFF] shadow-lg border border-gray-200">
          <div className="py-1">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLanguageChange(loc)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                  locale === loc ? 'bg-[#CEF248] text-black font-medium' : 'text-black'
                }`}
              >
                {localeNames[loc]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
