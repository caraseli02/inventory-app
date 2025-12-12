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
    :class="cn('flex flex-col space-y-1.5 p-6', attrs.class as string | undefined)"
  >
    <slot />
  </div>
</template>
