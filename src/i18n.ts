import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';

export const supportedLanguages = ['es', 'en', 'ro', 'ru'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

// Language display names in their native form (for selector UI)
export const languageNames: Record<SupportedLanguage, string> = {
  es: 'Español',
  en: 'English',
  ro: 'Română',
  ru: 'Русский',
};

const getInitialLanguage = () => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('preferredLanguage');

      if (stored && supportedLanguages.includes(stored as SupportedLanguage)) {
        return stored;
      }

      const browserLanguage = navigator.languages?.[0] ?? navigator.language;
      const normalized = browserLanguage?.split('-')[0];

      if (normalized && supportedLanguages.includes(normalized as SupportedLanguage)) {
        return normalized;
      }
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
    }
  }

  return 'es';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        translation: es
      },
      en: {
        translation: en
      },
      ro: {
        translation: ro
      },
      ru: {
        translation: ru
      }
    },
    lng: getInitialLanguage(),
    fallbackLng: 'es', // Fallback to Spanish if translation is missing
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false // Disable suspense to avoid loading issues
    }
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined' && supportedLanguages.includes(lng as SupportedLanguage)) {
    try {
      localStorage.setItem('preferredLanguage', lng);
    } catch (e) {
      console.warn('Failed to save language preference:', e);
    }
  }
});

export default i18n;
