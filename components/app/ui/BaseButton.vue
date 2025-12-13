<template>
  <Button
    :type="type"
    :disabled="disabled"
    :variant="mappedVariant"
    :class="widthClass"
    v-bind="$attrs"
  >
    <slot />
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/Button.vue'

const props = withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'ghost'
    fullWidth?: boolean
    disabled?: boolean
  }>(),
  {
    type: 'button',
    variant: 'primary',
    fullWidth: false,
    disabled: false,
  }
)

// Map app variants to shadcn Button variants
const mappedVariant = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'outline'
    case 'ghost':
      return 'ghost'
    case 'primary':
    default:
      return 'default'
  }
})

const widthClass = computed(() => (props.fullWidth ? 'w-full' : ''))
</script>
