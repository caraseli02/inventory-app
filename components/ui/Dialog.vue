<script setup lang="ts">
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const close = () => emit('update:modelValue', false)
</script>

<template>
  <teleport to="body">
    <div v-if="props.modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="close"></div>
      <div class="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl border border-stone-200">
        <header class="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div class="space-y-1">
            <slot name="title" />
            <slot name="description" />
          </div>
          <button class="p-2 text-stone-500 hover:text-stone-800" @click="close">×</button>
        </header>
        <div class="px-6 py-4">
          <slot />
        </div>
        <div v-if="$slots.footer" class="px-6 py-4 border-t border-stone-200">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </teleport>
</template>
