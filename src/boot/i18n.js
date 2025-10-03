import { defineBoot } from '#q-app/wrappers'
import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'
import { Lang } from 'quasar'

export default defineBoot(({ app }) => {
  const i18n = createI18n({
    locale: 'zh-TW',
    fallbackLocale: 'en-US',
    globalInjection: true,
    messages,
  })

  // Set i18n instance on app
  app.use(i18n)

  // Detect locale
  const locale = Lang.getLocale()
  i18n.global.locale.value = locale.includes('en')
    ? 'en-US'
    : locale.includes('ja')
      ? 'ja-JP'
      : i18n.global.availableLocales.includes(locale)
        ? locale
        : 'en-US'
})
