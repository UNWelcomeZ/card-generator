import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const tool = ref('pen')
  const bgColor = ref('#ff0000')
  const penSize = ref(50)
  const eraserSize = ref(50)
  const avatarImage = ref(new URL('src/assets/images/default-avatar.png', import.meta.url).href)
  const avatarBorderSize = ref(20)
  const avatarSize = ref(100)
  const name = ref('KENTO')

  return {
    tool,
    bgColor,
    penSize,
    eraserSize,
    avatarImage,
    avatarBorderSize,
    avatarSize,
    name,
  }
})
