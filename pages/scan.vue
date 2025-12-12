<script setup lang="ts">
import { useRouter } from 'vue-router'
import ScanPage from '~/src/vue/pages/ScanPage.vue'

const router = useRouter()
const goBack = () => router.push('/')
</script>

<template>
  <ScanPage @back="goBack" />
</template>
