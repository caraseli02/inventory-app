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
  <caption v-bind="forwardedAttrs" :class="cn('mt-4 text-sm text-muted-foreground', attrs.class as string | undefined)">
    <slot />
  </caption>
</template>
