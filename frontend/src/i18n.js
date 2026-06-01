import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import es from './locales/es/translation.json';
import fr from './locales/fr/translation.json';
import de from './locales/de/translation.json';
import ja from './locales/ja/translation.json';
import ko from './locales/ko/translation.json';
import hi from './locales/hi/translation.json';
import ar from './locales/ar/translation.json';
import it from './locales/it/translation.json';
import vi from './locales/vi/translation.json';
import pt from './locales/pt/translation.json';
import tr from './locales/tr/translation.json';
import ru from './locales/ru/translation.json';
import th from './locales/th/translation.json';
import fa from './locales/fa/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ja: { translation: ja },
      ko: { translation: ko },
      hi: { translation: hi },
      ar: { translation: ar },
      it: { translation: it },
      vi: { translation: vi },
      pt: { translation: pt },
      tr: { translation: tr },
      ru: { translation: ru },
      th: { translation: th },
      fa: { translation: fa },
    },
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'language',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
