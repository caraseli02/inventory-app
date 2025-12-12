import { defineNuxtPlugin } from '#app'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import es from '@/locales/es.json'
import en from '@/locales/en.json'
import ro from '@/locales/ro.json'
import ru from '@/locales/ru.json'

const supportedLanguages = ['es', 'en', 'ro', 'ru'] as const

const getInitialLanguage = () => {
  if (process.client) {
    try {
      const stored = localStorage.getItem('preferredLanguage')

      if (stored && supportedLanguages.includes(stored as (typeof supportedLanguages)[number])) {
        return stored
      }

      const browserLanguage = navigator.languages?.[0] ?? navigator.language
      const normalized = browserLanguage?.split('-')[0]

      if (normalized && supportedLanguages.includes(normalized as (typeof supportedLanguages)[number])) {
        return normalized
      }
    } catch (error) {
      console.warn('Failed to read language from storage', error)
    }
  }

  return 'es'
}

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = createI18n({
    legacy: false,
    locale: getInitialLanguage(),
    fallbackLocale: 'es',
    messages: {
      es,
      en,
      ro,
      ru,
    },
  })

  nuxtApp.vueApp.use(i18n)

  nuxtApp.provide('i18n', i18n)

  nuxtApp.hook('app:mounted', () => {
    watch(
      () => i18n.global.locale.value,
      (locale) => {
        if (process.client && supportedLanguages.includes(locale as (typeof supportedLanguages)[number])) {
          try {
            localStorage.setItem('preferredLanguage', locale)
          } catch (error) {
            console.warn('Failed to persist language preference', error)
          }
        }
      },
      { immediate: true },
    )
  })
})
