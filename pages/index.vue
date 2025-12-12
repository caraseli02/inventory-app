<template>
  <section class="space-y-6">
    <div class="space-y-4">
      <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Nuxt 3 Scaffold</p>
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Inventory App migration starting point</h1>
      <p class="max-w-2xl text-base text-slate-600">
        This project has been reconfigured with a Nuxt 3 application shell. Use this scaffold to
        migrate existing inventory features, connect modules, and replace React entry points with Vue
        equivalents.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-800">What&apos;s included</h2>
        <ul class="mt-3 space-y-2 text-sm text-slate-600">
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden="true" />
            Nuxt 3 app + page routing
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden="true" />
            Tailwind CSS module with starter styles
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden="true" />
            TypeScript + ESLint configured for Vue single-file components
          </li>
        </ul>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-800">Next steps</h2>
        <ol class="mt-3 space-y-2 text-sm text-slate-600">
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />
            Port components and composables from the React app into Vue equivalents.
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />
            Wire API routes, data fetching, and authentication into the Nuxt server/runtime.
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />
            Replace legacy build scripts with Nuxt workflows as new pages land.
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
