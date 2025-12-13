<script setup lang="ts">
import { useRouter } from '#app'
import InventoryListPage from '~/src/vue/pages/InventoryListPage.vue'

const router = useRouter()
const goBack = () => router.push('/')
</script>

<template>
  <InventoryListPage @back="goBack" />
</template>
