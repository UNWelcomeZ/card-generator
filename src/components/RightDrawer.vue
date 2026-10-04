<template lang="pug">
q-drawer(
  :model-value="true"
  persistent
  :width="250"
  :overlay="false"
  behavior="desktop"
  side="right"
)
  q-list(padding)
    template(v-if="appStore.tool === 'pen'")
      q-item-label(header) {{ $t('tools.pen.size') }}
      q-item
        q-item-section
          q-slider(
            :model-value="appStore.penSize"
            :min="PEN_SIZE_MIN"
            :max="PEN_SIZE_MAX"
            color="primary"
            track-color="white"
            label
            :label-value="`${appStore.penSize} px`"
            @update:model-value="setPenSize"
          )
      q-item
        q-item-section
          q-input(
            :model-value="appStore.penSize"
            suffix="px"
            type="number"
            :min="PEN_SIZE_MIN"
            :max="PEN_SIZE_MAX"
            color="primary"
            outlined
            @update:model-value="setPenSize"
          )
      q-separator(spaced)
      q-item(
        dark
        clickable
        v-ripple
        @click="clearAction.action"
      )
        q-item-section(avatar)
          q-icon(:name="clearAction.icon")
        q-item-section
          | {{ clearAction.label }}
    template(v-else-if="appStore.tool === 'eraser'")
      q-item-label(header) {{ $t('tools.eraser.size') }}
      q-item
        q-item-section
          q-slider(
            :model-value="appStore.eraserSize"
            :min="ERASER_SIZE_MIN"
            :max="ERASER_SIZE_MAX"
            color="primary"
            track-color="white"
            label
            :label-value="`${appStore.eraserSize} px`"
            @update:model-value="setEraserSize"
          )
      q-item
        q-item-section
          q-input(
            :model-value="appStore.eraserSize"
            suffix="px"
            type="number"
            :min="ERASER_SIZE_MIN"
            :max="ERASER_SIZE_MAX"
            color="primary"
            outlined
            @update:model-value="setEraserSize"
          )
      q-separator(spaced)
      q-item(
        dark
        clickable
        v-ripple
        @click="clearAction.action"
      )
        q-item-section(avatar)
          q-icon(:name="clearAction.icon")
        q-item-section
          | {{ clearAction.label }}
    template(v-else-if="appStore.tool === 'avatar'")
      input.hidden(
        ref="avatarInput"
        type="file"
        accept="image/png, image/jpeg"
        @change="selectAvatar"
      )
      q-item-label(header) {{ $t('tools.avatar.select') }}
      q-item
        q-img.full-width.cursor-pointer(
          :src="appStore.avatarImage || DEFAULT_AVATAR"
          :alt="$t('tools.avatar.change')"
          height="150px"
          fit="contain"
          @click="onAvatarInputClick"
        )
      q-item
        q-item-section
          q-btn(
            @click="onAvatarInputClick"
            :label="$t('tools.avatar.change')"
            icon="mdi-image-edit"
            flat
            no-caps
          )
        q-item-section
          q-btn(
            @click="onAvatarDeleteClick"
            :label="$t('tools.avatar.removeShort')"
            icon="mdi-delete"
            flat
            no-caps
          )
      q-separator(spaced)
      q-item-label(header) {{ $t('tools.avatar.borderSize') }}
      q-item
        q-item-section
          q-slider(
            :model-value="appStore.avatarBorderSize"
            :min="AVATAR_BORDER_SIZE_MIN"
            :max="AVATAR_BORDER_SIZE_MAX"
            color="primary"
            track-color="white"
            @update:model-value="setAvatarBorderSize"
          )
      q-item
        q-item-section
          q-input(
            :model-value="appStore.avatarBorderSize"
            type="number"
            :min="AVATAR_BORDER_SIZE_MIN"
            :max="AVATAR_BORDER_SIZE_MAX"
            color="primary"
            outlined
            @update:model-value="setAvatarBorderSize"
          )
      q-separator(spaced)
      q-item-label(header) {{ $t('tools.avatar.size') }}
      q-item
        q-item-section
          q-slider(
            :model-value="appStore.avatarSize"
            :min="AVATAR_SIZE_MIN"
            :max="AVATAR_SIZE_MAX"
            color="primary"
            track-color="white"
            @update:model-value="setAvatarSize"
          )
      q-item
        q-item-section
          q-input(
            :model-value="appStore.avatarSize"
            type="number"
            :min="AVATAR_SIZE_MIN"
            :max="AVATAR_SIZE_MAX"
            color="primary"
            outlined
            @update:model-value="setAvatarSize"
          )
    template(v-else-if="appStore.tool === 'bg'")
      q-item-label(header) {{ $t('tools.color.color') }}
      q-item
        q-item-section
          q-color(
            v-model="appStore.bgColor"
            flat
            dark
            @update:model-value="bus.emit('setBgColor')"
            style="min-height: 370px;"
          )
    template(v-else-if="appStore.tool === 'name'")
      q-item-label(header) {{ $t('tools.name.title') }}
      q-item
        q-item-section
          q-input(
            :model-value="appStore.name"
            :placeholder="$t('tools.name.placeholder')"
            color="primary"
            outlined
            @update:model-value="setName"
          )
</template>

<script setup>
import { useAppStore } from 'src/stores/app'
import { useTemplateRef, inject } from 'vue'
import { useToolsStore } from 'src/stores/tools'
import { storeToRefs } from 'pinia'

const appStore = useAppStore()
const toolsStore = useToolsStore()
const {
  PEN_SIZE_MIN,
  PEN_SIZE_MAX,
  ERASER_SIZE_MIN,
  ERASER_SIZE_MAX,
  AVATAR_BORDER_SIZE_MAX,
  AVATAR_BORDER_SIZE_MIN,
  AVATAR_SIZE_MAX,
  AVATAR_SIZE_MIN,
  DEFAULT_AVATAR,
} = toolsStore
const { clearAction } = storeToRefs(toolsStore)

const avatarInput = useTemplateRef('avatarInput')

const bus = inject('bus')

const setPenSize = (value) => {
  const numValue = parseFloat(value) || PEN_SIZE_MIN
  if (numValue < PEN_SIZE_MIN) {
    appStore.penSize = PEN_SIZE_MIN
  } else if (numValue > PEN_SIZE_MAX) {
    appStore.penSize = PEN_SIZE_MAX
  } else {
    appStore.penSize = numValue
  }
}
const setEraserSize = (value) => {
  const numValue = parseFloat(value) || ERASER_SIZE_MIN
  if (numValue < ERASER_SIZE_MIN) {
    appStore.eraserSize = ERASER_SIZE_MIN
  } else if (numValue > ERASER_SIZE_MAX) {
    appStore.eraserSize = ERASER_SIZE_MAX
  } else {
    appStore.eraserSize = numValue
  }
}
const setAvatarBorderSize = (value) => {
  const numValue = parseFloat(value) || AVATAR_BORDER_SIZE_MIN
  if (numValue < AVATAR_BORDER_SIZE_MIN) {
    appStore.avatarBorderSize = AVATAR_BORDER_SIZE_MIN
  } else if (numValue > AVATAR_BORDER_SIZE_MAX) {
    appStore.avatarBorderSize = AVATAR_BORDER_SIZE_MAX
  } else {
    appStore.avatarBorderSize = numValue
  }
  bus.emit('setAvatarBorderSize')
}

const setAvatarSize = (value) => {
  const numValue = parseFloat(value) || AVATAR_SIZE_MIN
  if (numValue < AVATAR_SIZE_MIN) {
    appStore.avatarSize = AVATAR_SIZE_MIN
  } else if (numValue > AVATAR_SIZE_MAX) {
    appStore.avatarSize = AVATAR_SIZE_MAX
  } else {
    appStore.avatarSize = numValue
  }
  bus.emit('setAvatarSize')
}

const onAvatarInputClick = () => {
  avatarInput.value.click()
}
const onAvatarDeleteClick = () => {
  bus.emit('removeAvatar')
  appStore.avatarImage = DEFAULT_AVATAR
}
const selectAvatar = (event) => {
  const file = event.target.files[0]
  // 清空選擇，再次選同一個檔案時才會觸發 change
  event.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    bus.emit('selectAvatar', e.target.result)
  }
  reader.readAsDataURL(file)
}

const setName = (value) => {
  appStore.name = value.trim().toUpperCase()
  bus.emit('setName')
}
</script>
