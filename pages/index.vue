<template>
  <section class="space-y-8">
    <div class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Nuxt migration</p>
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Inventory Console</h1>
      <p class="max-w-2xl text-base text-slate-600">
        Vue pages are now available in Nuxt. Airtable-backed data still requires <code>NUXT_PUBLIC_*</code> env vars.
        Use the links below to jump into the migrated experiences.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <NuxtLink
        to="/inventory"
        class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900">Inventory</h2>
          <span class="text-indigo-500 transition group-hover:translate-x-0.5">→</span>
        </div>
        <p class="mt-2 text-sm text-slate-600">View products, adjust stock, and filter by search.</p>
      </NuxtLink>

      <NuxtLink
        to="/scan"
        class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900">Scan</h2>
          <span class="text-indigo-500 transition group-hover:translate-x-0.5">→</span>
        </div>
        <p class="mt-2 text-sm text-slate-600">Lookup products by barcode and create new entries.</p>
      </NuxtLink>

      <NuxtLink
        to="/checkout"
        class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900">Checkout</h2>
          <span class="text-indigo-500 transition group-hover:translate-x-0.5">→</span>
        </div>
        <p class="mt-2 text-sm text-slate-600">Process cart items and decrement stock with toasts.</p>
      </NuxtLink>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 class="text-base font-semibold text-slate-900">Next steps</h3>
      <ul class="mt-3 space-y-2 text-sm text-slate-600">
        <li>Validate Airtable connectivity via the new pages.</li>
        <li>Align env vars with <code>.env.example</code> (<code>NUXT_PUBLIC_*</code> keys).</li>
        <li>Wire Nitro upload endpoint (<code>server/api/upload.post.ts</code>) into the UI.</li>
      </ul>
    </div>
  </section>
</template>
