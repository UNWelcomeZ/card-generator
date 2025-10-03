import { EventBus } from 'quasar'
import { defineBoot } from '#q-app/wrappers'

export const bus = new EventBus()

export default defineBoot(({ app }) => {
  // for Options API
  app.config.globalProperties.$bus = bus

  // for Composition API
  app.provide('bus', bus)
})
