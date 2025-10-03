<template lang="pug">
.row.justify-center.items-center.full-height
  q-btn.col.full-height(
    v-for="item in tools"
    :key="item.value"
    @click="appStore.tool = item.value"
    :icon="item.icon"
    :class="appStore.tool === item.value ? 'bg-primary text-white' : ''"
  )
  q-btn.col.full-height(
    icon="mdi-dots-horizontal"
  )
    q-popup-proxy(:breakpoint="1024")
      q-card(flat style="width: 300px")
        q-list.bg-dark
          q-item-label(header) {{ $t('actions.title') }}
          q-item(
            v-for="(item, index) in actions"
            :key="index"
            clickable
            @click="item.action"
          )
            q-item-section(avatar)
              q-icon(:name="item.icon")
            q-item-section {{ item.label }}
          q-separator(spaced)
          q-item-label(header) {{ $t('settings.i18n.title') }}
          q-item(
            v-for="availableLocale in availableLocales"
            :key="availableLocale"
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
import { useToolsStore } from 'stores/tools'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

const appStore = useAppStore()

const toolsStore = useToolsStore()
const { tools, actions } = storeToRefs(toolsStore)

const { availableLocales, locale } = useI18n()
</script>

<style lang="sass" scoped></style>
