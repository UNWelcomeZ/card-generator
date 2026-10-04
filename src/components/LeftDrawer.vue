<template lang="pug">
q-drawer(
  :model-value="true"
  persistent
  :width="250"
  :overlay="false"
  behavior="desktop"
)
  q-list(padding)
    //- Tools
    q-item-label(header) {{ $t('tools.title') }}
    q-item(
      v-for="(item, index) in tools"
      :key="index"
      dark
      clickable
      v-ripple
      :active="appStore.tool === item.value"
      @click="appStore.tool = item.value"
      active-class="bg-primary text-white"
    )
      q-item-section(avatar)
        q-icon(:name="item.icon")
      q-item-section
        | {{ item.label }}
    q-separator(spaced)
    //- Actions
    q-item-label(header) {{ $t('actions.title') }}
    //- 復原 / 重做，所有工具都可以使用
    q-item
      q-btn-group.full-width(flat spread)
        q-btn(
          v-for="item in historyActions"
          :key="item.value"
          @click="item.action"
          :icon="item.icon"
          :label="item.label"
          :disable="item.value === 'undo' ? !appStore.canUndo : !appStore.canRedo"
          no-caps
        )
    //- 主要操作：下載成品
    q-item
      q-btn.full-width(
        @click="downloadAction.action"
        :icon="downloadAction.icon"
        :label="downloadAction.label"
        color="primary"
        unelevated
        no-caps
      )
    q-item(
      v-for="(item, index) in actions"
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
    q-separator(spaced)
    //- Settings
    q-item-label(header) {{ $t('settings.title') }}
    q-expansion-item(
      icon="mdi-translate"
      :label="$t('settings.i18n.title')"
      dark
    )
      q-item(
        v-for="availableLocale in availableLocales"
        :key="availableLocale"
        :inset-level="1"
        clickable
        v-ripple
        :active="locale === availableLocale"
        @click="locale = availableLocale"
        active-class="bg-primary text-white"
      )
        q-item-section {{ $t(`settings.i18n.options.${availableLocale}`) }}
</template>

<script setup>
import { useAppStore } from 'stores/app'
import { useToolsStore } from 'src/stores/tools'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

const appStore = useAppStore()
const toolsStore = useToolsStore()
const { tools, downloadAction, actions, historyActions } = storeToRefs(toolsStore)
const { availableLocales, locale } = useI18n()
</script>
