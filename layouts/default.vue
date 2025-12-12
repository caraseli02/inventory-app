<template>
  <div class="min-h-dvh bg-[var(--color-cream)] text-stone-900 selection:bg-stone-200">
    <div class="flex min-h-dvh flex-col px-4 pb-0 pt-4 lg:px-8 lg:pt-8">
      <header class="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between lg:mb-12">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.25em] text-stone-400">Grocery Inventory</p>
          <h1 class="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">Inventory Console</h1>
        </div>
        <div class="flex items-center gap-3">
          <span class="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600 shadow-sm">
            Tablet Friendly
          </span>
        </div>
      </header>

      <main class="flex w-full flex-1 flex-col items-center">
        <div class="w-full max-w-5xl animate-in fade-in duration-300">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
