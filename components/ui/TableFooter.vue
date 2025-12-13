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
  <tfoot
    v-bind="forwardedAttrs"
    :class="cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', attrs.class as string | undefined)"
  >
    <slot />
  </tfoot>
</template>
