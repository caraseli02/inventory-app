<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-slate-200 bg-white/70 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-semibold text-white shadow-sm">
            IA
          </span>
          <div>
            <p class="text-sm font-semibold text-slate-800">Inventory App</p>
            <p class="text-xs text-slate-500">Nuxt 3 migration scaffold</p>
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
      <slot />
    </main>

    <footer class="border-t border-slate-200 bg-white/70 py-4 text-center text-xs text-slate-500">
      <p>Nuxt 3 scaffold ready for feature migration.</p>
    </footer>
  </div>
</template>
