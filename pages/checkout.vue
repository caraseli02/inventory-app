<script setup lang="ts">
import { useRouter } from 'vue-router'
import CheckoutPage from '~/src/vue/pages/CheckoutPage.vue'

const router = useRouter()
const goBack = () => router.push('/')
</script>

<template>
  <CheckoutPage @back="goBack" />
</template>
