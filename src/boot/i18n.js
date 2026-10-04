import { defineBoot } from '#q-app/wrappers'
import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'
import { Lang } from 'quasar'
import { watch } from 'vue'

// 使用者手動選擇的語言
const LOCALE_KEY = 'locale'

const getSavedLocale = () => {
  try {
    return localStorage.getItem(LOCALE_KEY)
  } catch {
    return null
  }
}

const saveLocale = (locale) => {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // 無法使用 localStorage 時只在本次瀏覽有效
  }
}

export default defineBoot(({ app }) => {
  const i18n = createI18n({
    locale: 'zh-TW',
    fallbackLocale: 'en-US',
    globalInjection: true,
    messages,
  })

  // Set i18n instance on app
  app.use(i18n)

  // 優先使用手動選擇過的語言，否則依瀏覽器語言判斷
  const savedLocale = getSavedLocale()
  if (savedLocale && i18n.global.availableLocales.includes(savedLocale)) {
    i18n.global.locale.value = savedLocale
  } else {
    // Detect locale
    const locale = Lang.getLocale()
    i18n.global.locale.value = locale.includes('en')
      ? 'en-US'
      : locale.includes('ja')
        ? 'ja-JP'
        : i18n.global.availableLocales.includes(locale)
          ? locale
          : 'en-US'
  }

  // 切換語言時記住選擇
  watch(i18n.global.locale, saveLocale)
})
