<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex space-x-8">
            <NuxtLink to="/" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-500">
              Dashboard
            </NuxtLink>
            <NuxtLink to="/events" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-500">
              Events
            </NuxtLink>
            <NuxtLink to="/actions" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-500">
              Pending Actions
            </NuxtLink>
            <NuxtLink to="/time-travel" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-500">
              Time Travel
            </NuxtLink>
            <NuxtLink to="/sales" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-500">
              Sales
            </NuxtLink>
            <NuxtLink to="/analytics" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-blue-500">
              Analytics
            </NuxtLink>
          </div>
          <div class="flex items-center">
            <span class="text-sm text-gray-500">Grocery Agent Orchestrator</span>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Grocery Agent Orchestrator',
  meta: [
    { name: 'description', content: 'Event-sourced grocery inventory system' }
  ]
})
</script>

<style>
.router-link-active {
  @apply border-blue-500 text-blue-600;
}
</style>
