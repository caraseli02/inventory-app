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
  <tr
    v-bind="forwardedAttrs"
    :class="cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', attrs.class as string | undefined)"
  >
    <slot />
  </tr>
</template>
