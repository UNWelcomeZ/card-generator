import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { defineStore } from 'pinia'
import { Dialog } from 'quasar'
import { bus } from 'src/boot/bus'

export const useToolsStore = defineStore('tools', () => {
  const { t } = useI18n()

  const tools = computed(() => [
    { value: 'pen', icon: 'mdi-pencil', label: t('tools.pen.title') },
    { value: 'eraser', icon: 'mdi-eraser', label: t('tools.eraser.title') },
    { value: 'avatar', icon: 'mdi-account-circle', label: t('tools.avatar.title') },
    { value: 'bg', icon: 'mdi-palette', label: t('tools.color.title') },
    { value: 'name', icon: 'mdi-format-text', label: t('tools.name.title') },
  ])

  // 主要操作：下載成品
  const downloadAction = computed(() => ({
    value: 'download',
    icon: 'mdi-download',
    label: t('actions.download'),
    shortLabel: t('actions.downloadShort'),
    action: () => bus.emit('download'),
  }))

  // 次要操作
  const actions = computed(() => [
    {
      value: 'downloadLayer',
      icon: 'mdi-download-multiple',
      label: t('actions.downloadLayer'),
      action: () => bus.emit('downloadLayer'),
    },
  ])

  // 復原 / 重做，所有工具都可以使用
  const historyActions = computed(() => [
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
  ])

  // 清除繪圖，先確認避免誤觸
  const clearAction = computed(() => ({
    value: 'clear',
    icon: 'mdi-delete-sweep',
    label: t('actions.clear'),
    action: () =>
      Dialog.create({
        title: t('actions.clearConfirm.title'),
        message: t('actions.clearConfirm.message'),
        dark: true,
        ok: { label: t('actions.clearConfirm.ok'), color: 'negative', flat: true },
        cancel: { label: t('actions.clearConfirm.cancel'), color: 'grey-4', flat: true },
      }).onOk(() => bus.emit('clear')),
  }))

  // 筆刷與橡皮擦大小即為筆刷直徑（畫布像素）
  const PEN_SIZE_MIN = 6
  const PEN_SIZE_MAX = 30
  const ERASER_SIZE_MIN = 6
  const ERASER_SIZE_MAX = 30
  const AVATAR_BORDER_SIZE_MIN = 1
  const AVATAR_BORDER_SIZE_MAX = 50
  const AVATAR_SIZE_MIN = 10
  const AVATAR_SIZE_MAX = 200

  const DEFAULT_AVATAR = new URL('src/assets/images/avatar.png', import.meta.url).href

  return {
    tools,
    downloadAction,
    actions,
    historyActions,
    clearAction,
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
