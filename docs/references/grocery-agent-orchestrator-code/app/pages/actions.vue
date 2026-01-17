<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Pending Actions</h1>
      <p class="mt-2 text-sm text-gray-600">
        Actions requiring human review and approval. Agent proposals gated by confidence thresholds and business rules.
      </p>
    </div>

    <div v-if="pending" class="text-center py-12">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      <p class="mt-2 text-sm text-gray-600">Loading pending actions...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <div v-else class="space-y-6">
      <div
        v-for="action in actions"
        :key="action.id"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-3 mb-3">
              <span :class="['inline-flex items-center px-3 py-1 rounded-full text-sm font-medium', getActionTypeClass(action.actionType)]">
                {{ action.actionType }}
              </span>
              <span class="text-sm text-gray-500">{{ formatTimestamp(action.ts) }}</span>
            </div>

            <div class="space-y-2">
              <div>
                <span class="text-sm font-medium text-gray-700">Product:</span>
                <span class="ml-2 text-sm text-gray-900">{{ action.productId }}</span>
              </div>

              <div v-if="action.proposed">
                <span class="text-sm font-medium text-gray-700">Confidence:</span>
                <span class="ml-2 text-sm text-gray-900">{{ (action.proposed.confidence * 100).toFixed(1) }}%</span>
                <div class="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div
                    :class="['h-2 rounded-full', getConfidenceColor(action.proposed.confidence)]"
                    :style="{ width: (action.proposed.confidence * 100) + '%' }"
                  ></div>
                </div>
              </div>

              <div v-if="action.proposed?.reason">
                <span class="text-sm font-medium text-gray-700">Reason:</span>
                <p class="mt-1 text-sm text-gray-600 italic">{{ action.proposed.reason }}</p>
              </div>

              <div v-if="action.proposed?.suggestedValueCents">
                <span class="text-sm font-medium text-gray-700">Suggested Change:</span>
                <span class="ml-2 text-sm text-gray-900">{{ formatCents(action.proposed.suggestedValueCents) }}</span>
              </div>

              <div v-if="action.proposed?.experimentId">
                <span class="text-sm font-medium text-gray-700">Experiment:</span>
                <span class="ml-2 text-sm text-gray-500 font-mono">{{ action.proposed.experimentId }} / {{ action.proposed.variant }}</span>
              </div>
            </div>
          </div>

          <div class="text-right text-xs text-gray-400 font-mono">
            {{ action.id.slice(0, 8) }}
          </div>
        </div>

        <div class="mt-6 flex items-center space-x-3">
          <button
            @click="handleDecision(action.id, 'approve')"
            :disabled="processingActions.has(action.id)"
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ processingActions.has(action.id) ? 'Processing...' : 'Approve' }}
          </button>
          <button
            @click="handleDecision(action.id, 'reject')"
            :disabled="processingActions.has(action.id)"
            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ processingActions.has(action.id) ? 'Processing...' : 'Reject' }}
          </button>
          <button
            @click="refresh"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Refresh
          </button>
        </div>
      </div>

      <div v-if="actions.length === 0" class="text-center py-12 bg-white rounded-lg border border-gray-200">
        <div class="mb-4">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-gray-500 font-medium">All caught up!</p>
        <p class="text-sm text-gray-400 mt-1">No actions currently require human review.</p>
        <p class="text-xs text-gray-400 mt-4">
          Tip: Actions with confidence &lt; 70% or violating business rules require approval.
        </p>
      </div>
    </div>

    <div v-if="successMessage" class="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg">
      <p class="text-green-800">{{ successMessage }}</p>
    </div>

    <div v-if="errorMessage" class="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
      <p class="text-red-800">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: response, pending, error, refresh } = await useFetch<{
  actions: Array<{
    id: string
    productId: string
    actionType: string
    status: string
    ts: string
    proposed?: {
      confidence: number
      reason: string
      suggestedValueCents: number
      experimentId: string
      variant: string
    }
  }>
  count: number
}>('/api/actions/pending')

const actions = computed(() => response.value?.actions || [])

const processingActions = ref(new Set<string>())
const successMessage = ref('')
const errorMessage = ref('')

function formatTimestamp(ts: string) {
  const date = new Date(ts)
  return date.toLocaleString()
}

function formatCents(cents: number) {
  return `€${(cents / 100).toFixed(2)}`
}

function getActionTypeClass(type: string) {
  const classes: Record<string, string> = {
    'REORDER': 'bg-blue-100 text-blue-800',
    'PRICE_INCREASE': 'bg-green-100 text-green-800',
    'PRICE_DECREASE': 'bg-orange-100 text-orange-800',
  }
  return classes[type] || 'bg-gray-100 text-gray-800'
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 0.7) return 'bg-green-500'
  if (confidence >= 0.5) return 'bg-yellow-500'
  return 'bg-red-500'
}

async function handleDecision(actionId: string, decision: 'approve' | 'reject') {
  processingActions.value.add(actionId)
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await $fetch('/api/human-decision', {
      method: 'POST',
      body: {
        actionId,
        decision,
        reviewerId: 'human-operator'
      }
    })

    successMessage.value = `Action ${decision === 'approve' ? 'approved' : 'rejected'} successfully!`

    // Clear message after 3 seconds
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)

    // Refresh the list
    await refresh()
  } catch (err: any) {
    errorMessage.value = err.data?.message || `Failed to ${decision} action`

    // Clear error after 5 seconds
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  } finally {
    processingActions.value.delete(actionId)
  }
}

// Manual refresh only - auto-refresh was causing state issues
</script>
