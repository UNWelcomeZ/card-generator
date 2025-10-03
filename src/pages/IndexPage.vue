<template lang="pug">
q-page-container
  //- Mobile toolbar
  q-header.bg-dark(v-if="isMobile")
    TopButtons
  //- PC toolbar
  LeftDrawer(v-if="!isMobile")
  //- PC toolbar
  RightDrawer(v-if="!isMobile")
  //- Main content
  q-page.bg-black
    MainCanvas
  //- Mobile toolbar
  q-footer.bg-dark(v-if="isMobile")
    BottomButtons
  DialogCropper
</template>

<script setup>
import MainCanvas from 'components/MainCanvas.vue'
import TopButtons from 'src/components/TopButtons.vue'
import BottomButtons from 'src/components/BottomButtons.vue'
import LeftDrawer from 'src/components/LeftDrawer.vue'
import RightDrawer from 'src/components/RightDrawer.vue'
import DialogCropper from 'src/components/DialogCropper.vue'
import { useQuasar } from 'quasar'
import { computed } from 'vue'

const $q = useQuasar()

const isMobile = computed(() => $q.screen.lt.md)
</script>

<style lang="sass" scoped>
.q-page-container
  height: 100vh;

.q-page
  height: 100vh;
  position: relative;
@media (max-width: $breakpoint-sm-max)
  .q-page
    height: calc(100% - 75px);
    position: relative;

.q-header
  height: 97px;
.q-footer
  height: 75px;
</style>
