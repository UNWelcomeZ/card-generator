import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const tool = ref('pen')
  const bgColor = ref('#ff0000')
  const penSize = ref(18)
  const eraserSize = ref(50)
  const avatarImage = ref(new URL('src/assets/images/default-avatar.png', import.meta.url).href)
  const avatarBorderSize = ref(20)
  const avatarSize = ref(106)
  const name = ref('KENTO')
  // 是否有可以復原 / 重做的步驟
  const canUndo = ref(false)
  const canRedo = ref(false)

  return {
    tool,
    bgColor,
    penSize,
    eraserSize,
    avatarImage,
    avatarBorderSize,
    avatarSize,
    name,
    canUndo,
    canRedo,
  }
})
