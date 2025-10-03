import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { defineStore } from 'pinia'
import { bus } from 'src/boot/bus'

export const useToolsStore = defineStore('tools', () => {
  const { t } = useI18n()

  const tools = computed(() => [
    { value: 'pen', icon: 'mdi-pencil', label: t('tools.pen.title') },
    { value: 'eraser', icon: 'mdi-eraser', label: t('tools.eraser.title') },
    { value: 'avatar', icon: 'mdi-image', label: t('tools.avatar.title') },
    { value: 'bg', icon: 'mdi-format-color-fill', label: t('tools.color.title') },
    { value: 'name', icon: 'mdi-account', label: t('tools.name.title') },
  ])

  const actions = computed(() => [
    {
      value: 'download',
      icon: 'mdi-download',
      label: t('actions.download'),
      action: () => bus.emit('download'),
    },
    {
      value: 'downloadLayer',
      icon: 'mdi-download-multiple',
      label: t('actions.downloadLayer'),
      action: () => bus.emit('downloadLayer'),
    },
  ])

  const penActions = computed(() => [
    {
      value: 'undo',
      icon: 'mdi-undo',
      label: t('actions.undo'),
      action: () => bus.emit('undo'),
    },
    {
      value: 'redo',
      icon: 'mdi-redo',
      label: t('actions.redo'),
      action: () => bus.emit('redo'),
    },
    {
      value: 'clear',
      icon: 'mdi-delete',
      label: t('actions.clear'),
      action: () => bus.emit('clear'),
    },
  ])

  const PEN_SIZE_MIN = 10
  const PEN_SIZE_MAX = 50
  const ERASER_SIZE_MIN = 10
  const ERASER_SIZE_MAX = 50
  const AVATAR_BORDER_SIZE_MIN = 1
  const AVATAR_BORDER_SIZE_MAX = 50
  const AVATAR_SIZE_MIN = 10
  const AVATAR_SIZE_MAX = 200

  const DEFAULT_AVATAR = new URL('src/assets/images/avatar.png', import.meta.url).href

  return {
    tools,
    actions,
    penActions,
    PEN_SIZE_MIN,
    PEN_SIZE_MAX,
    ERASER_SIZE_MIN,
    ERASER_SIZE_MAX,
    AVATAR_BORDER_SIZE_MIN,
    AVATAR_BORDER_SIZE_MAX,
    AVATAR_SIZE_MIN,
    AVATAR_SIZE_MAX,
    DEFAULT_AVATAR,
  }
})
