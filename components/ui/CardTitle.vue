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
  <div
    v-bind="forwardedAttrs"
    :class="cn('font-semibold leading-none tracking-tight', attrs.class as string | undefined)"
  >
    <slot />
  </div>
</template>
