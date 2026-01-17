<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Sales Dashboard</h1>
      <p class="mt-2 text-sm text-gray-600">
        Daily sales projection - derived from StockLevelChanged events with reason "SALE".
      </p>
    </div>

    <!-- Day Selector -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex items-center space-x-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Select Day</label>
          <input
            type="date"
            v-model="selectedDay"
            @change="fetchSales"
            class="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div class="pt-6">
          <button
            @click="goToToday"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Today
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="text-sm font-medium text-gray-500">Units Sold</div>
        <div class="mt-2 text-3xl font-bold text-red-600">{{ summary.totalUnitsSold }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="text-sm font-medium text-gray-500">Units Delivered</div>
        <div class="mt-2 text-3xl font-bold text-green-600">{{ summary.totalUnitsDelivered }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="text-sm font-medium text-gray-500">Products Active</div>
        <div class="mt-2 text-3xl font-bold text-blue-600">{{ summary.totalProductsSold }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="text-sm font-medium text-gray-500">Transactions</div>
        <div class="mt-2 text-3xl font-bold text-gray-900">{{ summary.totalTransactions }}</div>
      </div>
    </div>

    <!-- Sales Table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sold
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Delivered
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Net Change
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Transactions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="item in sales" :key="item.productId" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ item.productId }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right" :class="item.totalSold > 0 ? 'text-red-600' : 'text-gray-400'">
              {{ item.totalSold > 0 ? `-${item.totalSold}` : '0' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right" :class="item.totalDelivered > 0 ? 'text-green-600' : 'text-gray-400'">
              {{ item.totalDelivered > 0 ? `+${item.totalDelivered}` : '0' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right" :class="getNetChangeClass(item)">
              {{ getNetChange(item) > 0 ? '+' : '' }}{{ getNetChange(item) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
              {{ item.transactionCount }}
            </td>
          </tr>
          <tr v-if="sales.length === 0">
            <td colspan="5" class="px-6 py-12 text-center text-gray-500">
              No sales data for {{ selectedDay }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Rebuild Button -->
    <div class="mt-6 text-center">
      <button
        @click="rebuildProjection"
        :disabled="rebuilding"
        class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
      >
        {{ rebuilding ? 'Rebuilding...' : 'Rebuild Projection from Events' }}
      </button>
      <p class="mt-2 text-xs text-gray-500">
        This deletes the projection and replays all events to rebuild it.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const selectedDay = ref(new Date().toISOString().slice(0, 10))
const rebuilding = ref(false)

const { data, refresh } = await useFetch<{
  day: string
  sales: Array<{
    productId: string
    totalSold: number
    totalDelivered: number
    transactionCount: number
  }>
  summary: {
    totalProductsSold: number
    totalUnitsSold: number
    totalUnitsDelivered: number
    totalTransactions: number
  }
}>('/api/sales', {
  query: { day: selectedDay }
})

const sales = computed(() => data.value?.sales || [])
const summary = computed(() => data.value?.summary || {
  totalProductsSold: 0,
  totalUnitsSold: 0,
  totalUnitsDelivered: 0,
  totalTransactions: 0,
})

function fetchSales() {
  refresh()
}

function goToToday() {
  selectedDay.value = new Date().toISOString().slice(0, 10)
  refresh()
}

function getNetChange(item: { totalSold: number; totalDelivered: number }) {
  return item.totalDelivered - item.totalSold
}

function getNetChangeClass(item: { totalSold: number; totalDelivered: number }) {
  const net = getNetChange(item)
  if (net > 0) return 'text-green-600 font-medium'
  if (net < 0) return 'text-red-600 font-medium'
  return 'text-gray-500'
}

async function rebuildProjection() {
  rebuilding.value = true
  try {
    await $fetch('/api/sales/rebuild', { method: 'POST' })
    await refresh()
  } finally {
    rebuilding.value = false
  }
}
</script>
