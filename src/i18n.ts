import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        translation: es
      },
      en: {
        translation: en
      }
    },
    lng: 'es', // Default language is Spanish
    fallbackLng: 'es', // Fallback to Spanish if translation is missing
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false // Disable suspense to avoid loading issues
    }
  });

export default i18n;
