import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';

const supportedLanguages = ['es', 'en', 'ro', 'ru'] as const;

const getInitialLanguage = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('preferredLanguage');

    if (stored && supportedLanguages.includes(stored as (typeof supportedLanguages)[number])) {
      return stored;
    }

    const browserLanguage = navigator.languages?.[0] ?? navigator.language;
    const normalized = browserLanguage?.split('-')[0];

    if (normalized && supportedLanguages.includes(normalized as (typeof supportedLanguages)[number])) {
      return normalized;
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
  if (typeof window !== 'undefined') {
    localStorage.setItem('preferredLanguage', lng);
  }
});

export default i18n;
