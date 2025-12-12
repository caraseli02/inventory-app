<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '../utils/cn'

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const forwardedAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
</script>

<template>
  <thead v-bind="forwardedAttrs" :class="cn('[&_tr]:border-b', attrs.class as string | undefined)">
    <slot />
  </thead>
</template>
