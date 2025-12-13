<script setup lang="ts">
import { useRouter } from '#app'
import ScanPage from '~/src/vue/pages/ScanPage.vue'

const router = useRouter()
const goBack = () => router.push('/')
</script>

<template>
  <ScanPage @back="goBack" />
</template>
