<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Event Log</h1>
      <p class="mt-2 text-sm text-gray-600">
        Immutable append-only event stream. All state is derived from these events.
      </p>
    </div>

    <div class="mb-6 flex items-center space-x-4">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
        <select
          v-model="selectedType"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">All Events</option>
          <option value="StockLevelChanged">StockLevelChanged</option>
          <option value="ActionProposed">ActionProposed</option>
          <option value="ActionAuthorized">ActionAuthorized</option>
          <option value="ActionRejected">ActionRejected</option>
          <option value="ActionSuppressed">ActionSuppressed</option>
          <option value="HumanReviewRequired">HumanReviewRequired</option>
          <option value="HumanDecisionRecorded">HumanDecisionRecorded</option>
          <option value="ActionExecuted">ActionExecuted</option>
          <option value="PriceChanged">PriceChanged</option>
        </select>
      </div>

      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">Filter by Product</label>
        <input
          v-model="productFilter"
          type="text"
          placeholder="e.g., apple-001"
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div class="pt-7">
        <button
          @click="refresh"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Refresh
        </button>
      </div>
    </div>

    <div v-if="pending" class="text-center py-12">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      <p class="mt-2 text-sm text-gray-600">Loading events...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="event in filteredEvents"
        :key="event.id"
        class="bg-white rounded-lg shadow-sm border-l-4 p-6"
        :class="getEventBorderClass(event.type)"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-3">
              <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', getEventTypeClass(event.type)]">
                {{ event.type }}
              </span>
              <span class="text-sm text-gray-500">{{ formatTimestamp(event.ts) }}</span>
            </div>

            <div class="mt-3">
              <div class="text-sm text-gray-600">
                <span class="font-medium">Aggregate:</span> {{ event.aggregateType }} → {{ event.aggregateId }}
              </div>
              <div v-if="event.correlationId" class="text-xs text-gray-500 mt-1">
                <span class="font-medium">Correlation:</span> {{ event.correlationId }}
              </div>
            </div>

            <details class="mt-4">
              <summary class="cursor-pointer text-sm text-blue-600 hover:text-blue-800 font-medium">
                View Payload
              </summary>
              <pre class="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">{{ JSON.stringify(event.payload, null, 2) }}</pre>
            </details>
          </div>

          <div class="text-right text-xs text-gray-400 font-mono">
            {{ event.id.slice(0, 8) }}
          </div>
        </div>
      </div>

      <div v-if="filteredEvents.length === 0" class="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p class="text-gray-500">No events found matching your filters.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const selectedType = ref('')
const productFilter = ref('')

const { data: response, pending, error, refresh } = await useFetch<{
  events: Array<{
    id: string
    type: string
    ts: string
    aggregateType: string
    aggregateId: string
    correlationId?: string
    causationId?: string
    payload: any
  }>
  count: number
}>('/api/events')

const events = computed(() => response.value?.events || [])

const filteredEvents = computed(() => {
  if (!events.value) return []

  let filtered = events.value

  if (selectedType.value) {
    filtered = filtered.filter(e => e.type === selectedType.value)
  }

  if (productFilter.value) {
    filtered = filtered.filter(e =>
      e.aggregateId.includes(productFilter.value) ||
      (e.payload?.productId && e.payload.productId.includes(productFilter.value))
    )
  }

  return filtered
})

function formatTimestamp(ts: string) {
  const date = new Date(ts)
  return date.toLocaleString()
}

function getEventTypeClass(type: string) {
  const classes: Record<string, string> = {
    'StockLevelChanged': 'bg-blue-100 text-blue-800',
    'ActionProposed': 'bg-purple-100 text-purple-800',
    'ActionAuthorized': 'bg-green-100 text-green-800',
    'ActionRejected': 'bg-red-100 text-red-800',
    'ActionSuppressed': 'bg-yellow-100 text-yellow-800',
    'HumanReviewRequired': 'bg-orange-100 text-orange-800',
    'HumanDecisionRecorded': 'bg-indigo-100 text-indigo-800',
    'ActionExecuted': 'bg-green-100 text-green-800',
    'PriceChanged': 'bg-teal-100 text-teal-800',
  }
  return classes[type] || 'bg-gray-100 text-gray-800'
}

function getEventBorderClass(type: string) {
  const classes: Record<string, string> = {
    'StockLevelChanged': 'border-blue-500',
    'ActionProposed': 'border-purple-500',
    'ActionAuthorized': 'border-green-500',
    'ActionRejected': 'border-red-500',
    'ActionSuppressed': 'border-yellow-500',
    'HumanReviewRequired': 'border-orange-500',
    'HumanDecisionRecorded': 'border-indigo-500',
    'ActionExecuted': 'border-green-500',
    'PriceChanged': 'border-teal-500',
  }
  return classes[type] || 'border-gray-500'
}

// Manual refresh only - use the Refresh button
</script>
