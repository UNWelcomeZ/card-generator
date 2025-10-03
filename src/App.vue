<template lang="pug">
router-view
</template>

<script setup>
import { onMounted, inject } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

const bus = inject('bus')

const $q = useQuasar()
const { t } = useI18n()

const showUpdateBanner = () => {
  $q.notify({
    message: t('pwa.update'),
    icon: 'refresh',
    color: 'negative',
    position: 'top',
    timeout: 0,
    actions: [
      {
        label: t('pwa.refresh'),
        color: 'yellow',
        handler: () => {
          location.reload()
        },
      },
      {
        label: t('pwa.dismiss'),
        color: 'white',
        handler: () => {},
      },
    ],
  })
}

onMounted(() => {
  bus.on('sw-updated', showUpdateBanner)
})
</script>
