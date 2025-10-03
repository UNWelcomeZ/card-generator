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
            @update:model-value="setPenSize"
          )
      q-item
        q-item-section
          q-input(
            :model-value="appStore.penSize"
            type="number"
            :min="PEN_SIZE_MIN"
            :max="PEN_SIZE_MAX"
            color="primary"
            outlined
            @update:model-value="setPenSize"
          )
      q-separator(spaced)
      q-item(
        v-for="(item, index) in penActions"
        :key="index"
        dark
        clickable
        v-ripple
        @click="item.action"
      )
        q-item-section(avatar)
          q-icon(:name="item.icon")
        q-item-section
          | {{ item.label }}
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
            @update:model-value="setEraserSize"
          )
      q-item
        q-item-section
          q-input(
            :model-value="appStore.eraserSize"
            type="number"
            :min="ERASER_SIZE_MIN"
            :max="ERASER_SIZE_MAX"
            color="primary"
            outlined
            @update:model-value="setEraserSize"
          )
      q-separator(spaced)
      q-item(
        v-for="(item, index) in penActions"
        :key="index"
        dark
        clickable
        v-ripple
        @click="item.action"
      )
        q-item-section(avatar)
          q-icon(:name="item.icon")
        q-item-section
          | {{ item.label }}
    template(v-else-if="appStore.tool === 'avatar'")
      input.hidden(
        ref="avatarInput"
        type="file"
        accept="image/png, image/jpeg"
        @change="selectAvatar"
      )
      q-item-label(header) {{ $t('tools.avatar.select') }}
      q-item
        q-img.full-width(
          :src="appStore.avatarImage || DEFAULT_AVATAR"
          height="150px"
          fit="contain"
        )
      q-item
        q-item-section
          q-btn(flat icon="mdi-upload" @click="onAvatarInputClick")
        q-item-section
          q-btn(flat icon="mdi-delete" @click="onAvatarDeleteClick")
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
const { penActions } = storeToRefs(toolsStore)

const avatarInput = useTemplateRef('avatarInput')

const bus = inject('bus')

const setPenSize = (value) => {
  if (value < PEN_SIZE_MIN) {
    appStore.penSize = PEN_SIZE_MIN
  } else if (value > PEN_SIZE_MAX) {
    appStore.penSize = PEN_SIZE_MAX
  } else {
    appStore.penSize = value
  }
}
const setEraserSize = (value) => {
  if (value < ERASER_SIZE_MIN) {
    appStore.eraserSize = ERASER_SIZE_MIN
  } else if (value > ERASER_SIZE_MAX) {
    appStore.eraserSize = ERASER_SIZE_MAX
  } else {
    appStore.eraserSize = value
  }
}
const setAvatarBorderSize = (value) => {
  if (value < AVATAR_BORDER_SIZE_MIN) {
    appStore.avatarBorderSize = AVATAR_BORDER_SIZE_MIN
  } else if (value > AVATAR_BORDER_SIZE_MAX) {
    appStore.avatarBorderSize = AVATAR_BORDER_SIZE_MAX
  } else {
    appStore.avatarBorderSize = value
  }
  bus.emit('setAvatarBorderSize')
}

const setAvatarSize = (value) => {
  if (value < AVATAR_SIZE_MIN) {
    appStore.avatarSize = AVATAR_SIZE_MIN
  } else if (value > AVATAR_SIZE_MAX) {
    appStore.avatarSize = AVATAR_SIZE_MAX
  } else {
    appStore.avatarSize = value
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
  const reader = new FileReader()
  reader.onload = (e) => {
    bus.emit('selectAvatar', e.target.result)
  }
  reader.readAsDataURL(event.target.files[0])
}

const setName = (value) => {
  appStore.name = value.trim().toUpperCase()
  bus.emit('setName')
}
</script>
