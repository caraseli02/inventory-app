<template>
  <section
    class="rounded-2xl border border-stone-200 bg-white shadow-sm"
    role="region"
    :aria-label="ariaLabel"
  >
    <header v-if="title || description" class="border-b border-stone-100 px-4 py-3">
      <p v-if="eyebrow" class="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">{{ eyebrow }}</p>
      <div class="flex items-start justify-between gap-2">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-stone-900">{{ title }}</h2>
          <p v-if="description" class="text-sm text-stone-500">{{ description }}</p>
        </div>
        <slot name="actions" />
      </div>
    </header>
    <div class="p-4">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
  eyebrow?: string;
  ariaLabel?: string;
}>();
</script>
