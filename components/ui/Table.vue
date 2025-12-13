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
  <div class="relative w-full overflow-auto">
    <table
      v-bind="forwardedAttrs"
      :class="cn('w-full caption-bottom text-sm', attrs.class as string | undefined)"
    >
      <slot />
    </table>
  </div>
</template>
