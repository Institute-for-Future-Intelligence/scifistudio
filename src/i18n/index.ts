import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import ko from './locales/ko.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import uk from './locales/uk.json'
import ja from './locales/ja.json'
import it from './locales/it.json'
import pt from './locales/pt.json'
import el from './locales/el.json'
import ru from './locales/ru.json'
import tr from './locales/tr.json'
import ar from './locales/ar.json'
import fa from './locales/fa.json'
import th from './locales/th.json'
import id from './locales/id.json'

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  ko: { translation: ko },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  uk: { translation: uk },
  ja: { translation: ja },
  it: { translation: it },
  pt: { translation: pt },
  el: { translation: el },
  ru: { translation: ru },
  tr: { translation: tr },
  ar: { translation: ar },
  fa: { translation: fa },
  th: { translation: th },
  id: { translation: id },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng) => {
        // Convert en-US, en-GB etc. to just 'en'
        if (lng.startsWith('en')) return 'en'
        if (lng.startsWith('zh-TW') || lng.startsWith('zh-Hant')) return 'zh-TW'
        if (lng.startsWith('zh')) return 'zh-CN'
        if (lng.startsWith('ko')) return 'ko'
        if (lng.startsWith('es')) return 'es'
        if (lng.startsWith('fr')) return 'fr'
        if (lng.startsWith('de')) return 'de'
        if (lng.startsWith('uk')) return 'uk'
        if (lng.startsWith('ja')) return 'ja'
        if (lng.startsWith('it')) return 'it'
        if (lng.startsWith('pt')) return 'pt'
        if (lng.startsWith('el')) return 'el'
        if (lng.startsWith('ru')) return 'ru'
        if (lng.startsWith('tr')) return 'tr'
        if (lng.startsWith('ar')) return 'ar'
        if (lng.startsWith('fa')) return 'fa'
        if (lng.startsWith('th')) return 'th'
        if (lng.startsWith('id')) return 'id'
        return lng
      },
    },
  })

export default i18n
