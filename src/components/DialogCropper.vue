<template lang="pug">
q-dialog(v-model="open" persistent maximized)
  q-card.full-height(flat)
    q-card-section.q-pb-sm
      .text-h6 {{ $t('dialog.crop.title') }}
    q-card-section#cropper.q-pa-none
      vue-cropper(
        ref="cropper"
        :src="cropperImage"
        :view-mode="2"
        class="vue-cropper"
        :auto-crop-area="1"
      )
    q-card-actions(align="right")
      q-btn(flat :label="$t('dialog.crop.cancel')" @click="open = false")
      q-btn(flat :label="$t('dialog.crop.confirm')" @click="crop")
</template>

<script setup>
import { ref, useTemplateRef, inject } from 'vue'
import { useAppStore } from 'src/stores/app'
import VueCropper from 'vue-cropperjs'
import 'cropperjs/dist/cropper.css'

const appStore = useAppStore()

const bus = inject('bus')

const open = ref(false)

const cropper = useTemplateRef('cropper')
const cropperImage = ref(null)

bus.on('selectAvatar', (image) => {
  open.value = true
  cropperImage.value = image
})

const crop = () => {
  const image = cropper.value.getCroppedCanvas().toDataURL('image/png')
  appStore.avatarImage = image
  bus.emit('cropAvatar')
  open.value = false
}
</script>

<style scoped>
#cropper {
  width: 100%;
  height: calc(100% - 52px - 56px);
}
.vue-cropper {
  width: 100%;
  height: 100%;
}
</style>
