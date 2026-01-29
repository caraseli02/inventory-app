<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Product Dashboard</h1>
      <p class="mt-2 text-sm text-gray-600">
        Current stock levels across all products. Event-sourced state derived from {{ eventCount }} events.
      </p>
    </div>

    <div v-if="pending" class="text-center py-12">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      <p class="mt-2 text-sm text-gray-600">Loading products...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="product in products"
        :key="product.productId"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">{{ product.productId }}</h3>
            <p class="text-sm text-gray-500 mt-1">Updated {{ formatTime(product.updatedAt) }}</p>
          </div>
          <span
            :class="[
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              getStockStatusClass(product.quantity)
            ]"
          >
            {{ product.quantity }} units
          </span>
        </div>

        <div class="mt-4 flex items-center justify-between text-sm">
          <span class="text-gray-500">Stock Level</span>
          <div class="flex items-center space-x-2">
            <div class="w-24 bg-gray-200 rounded-full h-2">
              <div
                :class="['h-2 rounded-full', getStockBarClass(product.quantity)]"
                :style="{ width: getStockPercentage(product.quantity) + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-gray-100">
          <NuxtLink
            :to="`/products/${product.productId}`"
            class="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View History →
          </NuxtLink>
        </div>
      </div>
    </div>

    <div v-if="!pending && products.length === 0" class="text-center py-12">
      <p class="text-gray-500">No products found. Start by posting a StockLevelChanged event.</p>
      <pre class="mt-4 text-left inline-block bg-gray-100 rounded-lg p-4 text-sm">
curl -X POST http://localhost:3000/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "apple-001",
    "delta": 100,
    "reason": "DELIVERY",
    "threshold": 20
  }'
      </pre>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: products, pending, error, refresh } = await useFetch<Array<{
  productId: string
  quantity: number
  updatedAt: string
}>>('/api/products/stock')

const { data: eventsData } = await useFetch('/api/events')
const eventCount = computed(() => Array.isArray(eventsData.value) ? eventsData.value.length : 0)

function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getStockStatusClass(quantity: number) {
  if (quantity === 0) return 'bg-red-100 text-red-800'
  if (quantity < 20) return 'bg-yellow-100 text-yellow-800'
  if (quantity < 50) return 'bg-blue-100 text-blue-800'
  return 'bg-green-100 text-green-800'
}

function getStockBarClass(quantity: number) {
  if (quantity === 0) return 'bg-red-500'
  if (quantity < 20) return 'bg-yellow-500'
  if (quantity < 50) return 'bg-blue-500'
  return 'bg-green-500'
}

function getStockPercentage(quantity: number) {
  return Math.min(100, (quantity / 100) * 100)
}

// Manual refresh only
</script>
