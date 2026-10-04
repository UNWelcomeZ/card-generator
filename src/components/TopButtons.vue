<template lang="pug">
.row.no-wrap.full-height
  //- 目前工具的選項
  .col.full-height
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
        q-item.q-py-none
          q-btn(
            @click="clearAction.action"
            :icon="clearAction.icon"
            :label="clearAction.label"
            flat
            dense
            no-caps
            size="sm"
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
        q-item.q-py-none
          q-btn(
            @click="clearAction.action"
            :icon="clearAction.icon"
            :label="clearAction.label"
            flat
            dense
            no-caps
            size="sm"
          )
    template(v-else-if="appStore.tool === 'avatar'")
      input.hidden(
        ref="avatarInput"
        type="file"
        accept="image/png, image/jpeg"
        @change="selectAvatar"
      )
      .row.no-wrap.items-center.full-height.q-pl-sm
        .col
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
        //- 目前的頭像，點擊即可更換
        .col-auto.column.items-center.q-px-xs
          .avatar-thumb
            q-img.cursor-pointer.rounded-borders(
              :src="appStore.avatarImage || DEFAULT_AVATAR"
              :alt="$t('tools.avatar.change')"
              fit="contain"
              width="64px"
              height="50px"
              @click="onAvatarInputClick"
            )
            q-btn.avatar-remove(
              v-if="hasAvatar"
              @click="onAvatarDeleteClick"
              :aria-label="$t('tools.avatar.remove')"
              icon="mdi-close-circle"
              round
              dense
              flat
              size="sm"
            )
          q-btn(
            @click="onAvatarInputClick"
            :label="$t('tools.avatar.change')"
            icon="mdi-image-edit"
            flat
            dense
            no-caps
            size="sm"
          )
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
  q-separator(vertical dark)
  //- 復原 / 重做，所有工具都可以使用
  .column.no-wrap.justify-center
    q-btn(
      v-for="item in historyActions"
      :key="item.value"
      @click="item.action"
      :icon="item.icon"
      :aria-label="item.label"
      :disable="item.value === 'undo' ? !appStore.canUndo : !appStore.canRedo"
      flat
    )
</template>

<script setup>
import { useTemplateRef, inject, computed } from 'vue'
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
const { historyActions, clearAction } = storeToRefs(toolsStore)

const avatarInput = useTemplateRef('avatarInput')
const colorInput = useTemplateRef('colorInput')

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

// 是否有使用中的頭像（移除後會顯示預設的佔位圖）
const hasAvatar = computed(() => appStore.avatarImage && appStore.avatarImage !== DEFAULT_AVATAR)

const setName = (value) => {
  appStore.name = value.trim().toUpperCase()
  bus.emit('setName')
}
</script>

<style lang="sass" scoped>
.avatar-thumb
  position: relative
.avatar-remove
  position: absolute
  top: -8px
  right: -8px
  background: #1d1d1d
</style>
