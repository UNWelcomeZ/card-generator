<template lang="pug">
template(v-if="appStore.tool === 'pen'")
  q-list
    q-item
      q-item-section(side)
        q-icon(
          name="mdi-circle"
          size="10px"
          color="white"
        )
      q-item-section
        q-slider(
          :model-value="appStore.penSize"
          :min="PEN_SIZE_MIN"
          :max="PEN_SIZE_MAX"
          color="primary"
          track-color="white"
          @update:model-value="setPenSize"
        )
      q-item-section(side)
        q-icon(
          name="mdi-circle"
          size="20px"
          color="white"
        )
    q-separator
    q-item.q-pa-none
      q-item-section(
        v-for="(item, index) in penActions"
        :key="index"
      )
        q-btn.full-height(
          @click="item.action"
          :icon="item.icon"
        )
template(v-else-if="appStore.tool === 'eraser'")
  q-list
    q-item
      q-item-section(side)
        q-icon(
          name="mdi-circle"
          size="10px"
          color="white"
        )
      q-item-section
        q-slider(
          :model-value="appStore.eraserSize"
          :min="ERASER_SIZE_MIN"
          :max="ERASER_SIZE_MAX"
          color="primary"
          track-color="white"
          @update:model-value="setEraserSize"
        )
      q-item-section(side)
        q-icon(
          name="mdi-circle"
          size="20px"
          color="white"
        )
    q-separator
    q-item.q-pa-none
      q-item-section(
        v-for="(item, index) in penActions"
        :key="index"
      )
        q-btn.full-height(
          @click="item.action"
          :icon="item.icon"
        )
template(v-else-if="appStore.tool === 'avatar'")
  input.hidden(
    ref="avatarInput"
    type="file"
    accept="image/png, image/jpeg"
    @change="selectAvatar"
  )
  .row.justify-center.items-center.full-height.q-px-sm
    .col-9
      q-list
        q-item
          q-item-section(side)
            q-icon(
              name="mdi-border-all-variant"
              size="20px"
              color="white"
            )
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
          q-item-section(side)
            q-icon(
              name="mdi-image-size-select-large"
              size="20px"
              color="white"
            )
          q-item-section
            q-slider(
              :model-value="appStore.avatarSize"
              :min="AVATAR_SIZE_MIN"
              :max="AVATAR_SIZE_MAX"
              color="primary"
              track-color="white"
              @update:model-value="setAvatarSize"
            )
    .col-3
      q-img.cursor-pointer(
        :src="appStore.avatarImage || DEFAULT_AVATAR"
        fit="contain"
        height="80px"
      )
        q-popup-proxy(:breakpoint="1024")
          q-card(flat style="width: 300px")
            q-card-section
              .text-h6 {{ $t('tools.avatar.select') }}
            q-card-section
              q-btn-group(spread flat)
                q-btn(flat icon="mdi-upload" @click="onAvatarInputClick")
                q-btn(flat icon="mdi-delete" @click="onAvatarDeleteClick")
template(v-else-if="appStore.tool === 'bg'")
  input.hidden(
    type="color"
    v-model="appStore.bgColor"
    @input="bus.emit('setBgColor')"
    ref="colorInput"
  )
  .row.justify-center.items-center.full-height.q-px-sm
    .col-3.full-height.q-pa-md
      .full-height.full-width.cursor-pointer(
        :style="{ backgroundColor: appStore.bgColor }"
        @click="colorInput.click()"
      )
    .col-9
      q-input(
        v-model="appStore.bgColor"
        color="primary"
        outlined
        @update:model-value="bus.emit('setBgColor')"
      )
template(v-else-if="appStore.tool === 'name'")
  .row.justify-center.items-center.full-height.q-px-sm
    .col-12
      q-input(
        :model-value="appStore.name"
        :placeholder="$t('tools.name.placeholder')"
        color="primary"
        outlined
        @update:model-value="setName"
      )
</template>

<script setup>
import { useTemplateRef, inject } from 'vue'
import { useAppStore } from 'stores/app'
import { useToolsStore } from 'stores/tools'
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
const colorInput = useTemplateRef('colorInput')

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

<style lang="sass" scoped></style>
