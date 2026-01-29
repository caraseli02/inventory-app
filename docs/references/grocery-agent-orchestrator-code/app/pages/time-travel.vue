<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Time Travel Debugger</h1>
      <p class="mt-2 text-sm text-gray-600">
        Scrub through history to see the system state at any point in time.
        This is only possible because events are immutable and state is derived.
      </p>
    </div>

    <!-- Time Controls -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-sm font-medium text-gray-700">Timeline</span>
          <p class="text-xs text-gray-500 mt-1">
            {{ eventsProcessed }} events processed at selected time
          </p>
        </div>
        <div class="text-right">
          <span class="text-sm font-medium text-gray-900">{{ formatTimestamp(selectedTimestamp) }}</span>
          <p class="text-xs text-gray-500 mt-1">Selected point in time</p>
        </div>
      </div>

      <!-- Timeline Slider -->
      <div class="relative mb-4">
        <input
          type="range"
          :min="0"
          :max="timelineSteps"
          v-model="sliderValue"
          @input="onSliderChange"
          class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div class="flex justify-between text-xs text-gray-500 mt-2">
          <span>{{ formatTimestamp(bounds.firstEvent) }}</span>
          <span>{{ formatTimestamp(bounds.lastEvent) }}</span>
        </div>
      </div>

      <!-- Quick Navigation -->
      <div class="flex space-x-2">
        <button
          @click="goToStart"
          class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          ⏮ Start
        </button>
        <button
          @click="stepBackward"
          class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          ◀ Step Back
        </button>
        <button
          @click="stepForward"
          class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          Step Forward ▶
        </button>
        <button
          @click="goToEnd"
          class="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
        >
          Now ⏭
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      <p class="mt-2 text-sm text-gray-600">Rebuilding state from events...</p>
    </div>

    <!-- State Display -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Stock Levels at Time -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          Stock Levels
          <span class="text-sm font-normal text-gray-500">({{ stockLevels.length }} products)</span>
        </h2>

        <div v-if="stockLevels.length === 0" class="text-center py-8 text-gray-500">
          No stock data at this point in time
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="stock in stockLevels"
            :key="stock.productId"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div>
              <span class="font-medium text-gray-900">{{ stock.productId }}</span>
              <p class="text-xs text-gray-500">Updated: {{ formatTimestamp(stock.updatedAt) }}</p>
            </div>
            <span
              :class="[
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium',
                getStockStatusClass(stock.quantity)
              ]"
            >
              {{ stock.quantity }} units
            </span>
          </div>
        </div>
      </div>

      <!-- Actions at Time -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          Action States
          <span class="text-sm font-normal text-gray-500">({{ actions.length }} actions)</span>
        </h2>

        <div v-if="actions.length === 0" class="text-center py-8 text-gray-500">
          No actions at this point in time
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="action in actions"
            :key="action.actionId"
            class="p-3 bg-gray-50 rounded-lg"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', getActionTypeClass(action.actionType)]">
                  {{ action.actionType }}
                </span>
                <span class="text-sm text-gray-900">{{ action.productId }}</span>
              </div>
              <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', getStatusClass(action.status)]">
                {{ action.status }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ action.actionId.slice(0, 12) }}...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Counts -->
    <div class="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Events Up To This Point</h2>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(count, type) in eventCounts"
          :key="type"
          :class="['inline-flex items-center px-3 py-1 rounded-full text-sm', getEventTypeClass(type as string)]"
        >
          {{ type }}: {{ count }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const sliderValue = ref(100)
const timelineSteps = 100
const loading = ref(false)

// Fetch initial bounds
const { data: initialData } = await useFetch<{
  bounds: { firstEvent: string; lastEvent: string; totalEvents: number }
  eventsProcessed: number
  eventCounts: Record<string, number>
  state: {
    stockLevels: Array<{ productId: string; quantity: number; updatedAt: string }>
    actions: Array<{ actionId: string; productId: string; actionType: string; status: string; timestamp: string }>
  }
}>('/api/state-at-time', {
  query: { timestamp: new Date().toISOString() }
})

const bounds = ref({
  firstEvent: initialData.value?.bounds.firstEvent || new Date().toISOString(),
  lastEvent: initialData.value?.bounds.lastEvent || new Date().toISOString(),
})

const selectedTimestamp = ref(bounds.value.lastEvent)
const eventsProcessed = ref(initialData.value?.eventsProcessed || 0)
const eventCounts = ref<Record<string, number>>(initialData.value?.eventCounts || {})
const stockLevels = ref(initialData.value?.state.stockLevels || [])
const actions = ref(initialData.value?.state.actions || [])

// Calculate timestamp from slider position
function getTimestampFromSlider(value: number): string {
  const start = new Date(bounds.value.firstEvent).getTime()
  const end = new Date(bounds.value.lastEvent).getTime()
  const position = value / timelineSteps
  const timestamp = new Date(start + (end - start) * position)
  return timestamp.toISOString()
}

// Fetch state at specific timestamp
async function fetchStateAtTime(timestamp: string) {
  loading.value = true
  try {
    const data = await $fetch<{
      eventsProcessed: number
      eventCounts: Record<string, number>
      state: {
        stockLevels: Array<{ productId: string; quantity: number; updatedAt: string }>
        actions: Array<{ actionId: string; productId: string; actionType: string; status: string; timestamp: string }>
      }
    }>('/api/state-at-time', {
      query: { timestamp }
    })

    eventsProcessed.value = data.eventsProcessed
    eventCounts.value = data.eventCounts
    stockLevels.value = data.state.stockLevels
    actions.value = data.state.actions
  } finally {
    loading.value = false
  }
}

// Slider change handler (debounced)
let debounceTimer: ReturnType<typeof setTimeout>
function onSliderChange() {
  clearTimeout(debounceTimer)
  selectedTimestamp.value = getTimestampFromSlider(sliderValue.value)
  debounceTimer = setTimeout(() => {
    fetchStateAtTime(selectedTimestamp.value)
  }, 200)
}

// Navigation functions
function goToStart() {
  sliderValue.value = 0
  selectedTimestamp.value = bounds.value.firstEvent
  fetchStateAtTime(selectedTimestamp.value)
}

function goToEnd() {
  sliderValue.value = timelineSteps
  selectedTimestamp.value = bounds.value.lastEvent
  fetchStateAtTime(selectedTimestamp.value)
}

function stepBackward() {
  if (sliderValue.value > 0) {
    sliderValue.value = Math.max(0, sliderValue.value - 5)
    selectedTimestamp.value = getTimestampFromSlider(sliderValue.value)
    fetchStateAtTime(selectedTimestamp.value)
  }
}

function stepForward() {
  if (sliderValue.value < timelineSteps) {
    sliderValue.value = Math.min(timelineSteps, sliderValue.value + 5)
    selectedTimestamp.value = getTimestampFromSlider(sliderValue.value)
    fetchStateAtTime(selectedTimestamp.value)
  }
}

// Formatting helpers
function formatTimestamp(ts: string) {
  if (!ts) return 'N/A'
  const date = new Date(ts)
  return date.toLocaleString()
}

function getStockStatusClass(quantity: number) {
  if (quantity === 0) return 'bg-red-100 text-red-800'
  if (quantity < 20) return 'bg-yellow-100 text-yellow-800'
  if (quantity < 50) return 'bg-blue-100 text-blue-800'
  return 'bg-green-100 text-green-800'
}

function getActionTypeClass(type: string) {
  const classes: Record<string, string> = {
    'REORDER': 'bg-blue-100 text-blue-800',
    'PRICE_INCREASE': 'bg-green-100 text-green-800',
    'PRICE_DECREASE': 'bg-orange-100 text-orange-800',
  }
  return classes[type] || 'bg-gray-100 text-gray-800'
}

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    'PROPOSED': 'bg-purple-100 text-purple-800',
    'NEEDS_HUMAN_REVIEW': 'bg-orange-100 text-orange-800',
    'AUTHORIZED': 'bg-green-100 text-green-800',
    'REJECTED': 'bg-red-100 text-red-800',
    'EXECUTED': 'bg-green-100 text-green-800',
    'SUPPRESSED': 'bg-yellow-100 text-yellow-800',
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
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
</script>

<style scoped>
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
</style>
