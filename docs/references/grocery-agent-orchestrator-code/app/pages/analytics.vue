<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-3xl font-bold">Analytics Dashboard</h1>
      <button
        @click="rebuildAnalytics"
        :disabled="rebuilding"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {{ rebuilding ? 'Rebuilding...' : 'Rebuild Analytics' }}
      </button>
    </div>

    <p class="text-gray-600 mb-6">
      Independent consumer reading the same event stream as the main workflow.
      Demonstrates <strong>Part III: Event Streams as Shared Source of Truth</strong>.
    </p>

    <!-- Stock Health -->
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Stock Health</h2>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Current Stock</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Avg Daily Use</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Days Until Stockout</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="item in health" :key="item.product_id">
              <td class="px-6 py-4 font-mono text-sm">{{ item.product_id }}</td>
              <td class="px-6 py-4">{{ item.current_stock }}</td>
              <td class="px-6 py-4">{{ item.avg_daily_consumption.toFixed(2) }}</td>
              <td class="px-6 py-4">
                {{ item.days_until_stockout ? item.days_until_stockout.toFixed(1) : 'N/A' }}
              </td>
              <td class="px-6 py-4">
                <span :class="getHealthBadgeClass(item.health_status)" class="px-2 py-1 rounded text-xs font-semibold">
                  {{ item.health_status }}
                </span>
              </td>
            </tr>
            <tr v-if="health.length === 0">
              <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                No health data available. Rebuild analytics to populate.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Product Velocity -->
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Product Velocity (7-Day Window)</h2>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Units Sold</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Avg Per Day</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Last Sale</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="item in velocity7d" :key="item.product_id">
              <td class="px-6 py-4 font-mono text-sm">{{ item.product_id }}</td>
              <td class="px-6 py-4">{{ item.units_sold }}</td>
              <td class="px-6 py-4 font-semibold">{{ item.avg_per_day.toFixed(2) }}</td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ formatTimestamp(item.last_sale_ts) }}</td>
            </tr>
            <tr v-if="velocity7d.length === 0">
              <td colspan="4" class="px-6 py-8 text-center text-gray-500">
                No velocity data available. Rebuild analytics to populate.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Agent Performance -->
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Agent Performance by Confidence</h2>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Confidence Range</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total Proposals</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Approved</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rejected</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Approval Rate</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="item in performance" :key="item.confidence_bucket">
              <td class="px-6 py-4 font-mono">{{ item.confidence_bucket }}</td>
              <td class="px-6 py-4">{{ item.total_proposals }}</td>
              <td class="px-6 py-4 text-green-600">{{ item.approved_count }}</td>
              <td class="px-6 py-4 text-red-600">{{ item.rejected_count }}</td>
              <td class="px-6 py-4">
                <div class="flex items-center">
                  <span class="font-semibold mr-2">{{ (item.approval_rate * 100).toFixed(1) }}%</span>
                  <div class="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      class="bg-blue-600 h-2 rounded-full"
                      :style="{ width: `${item.approval_rate * 100}%` }"
                    ></div>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="performance.length === 0">
              <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                No performance data available. Make some decisions and rebuild analytics.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Decision Latency -->
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Decision Latency</h2>

      <!-- Summary Stats -->
      <div v-if="latencySummary" class="grid grid-cols-4 gap-4 mb-4">
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-gray-600 text-sm">Total Decisions</div>
          <div class="text-2xl font-bold">{{ latencySummary.total_decisions }}</div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-gray-600 text-sm">Avg Latency</div>
          <div class="text-2xl font-bold">{{ formatSeconds(latencySummary.avg_latency) }}</div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-gray-600 text-sm">Min Latency</div>
          <div class="text-2xl font-bold">{{ formatSeconds(latencySummary.min_latency) }}</div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-gray-600 text-sm">Max Latency</div>
          <div class="text-2xl font-bold">{{ formatSeconds(latencySummary.max_latency) }}</div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Confidence</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Latency</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Decision</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Proposed At</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="item in latency" :key="item.action_id">
              <td class="px-6 py-4 font-mono text-sm">{{ item.product_id }}</td>
              <td class="px-6 py-4">{{ item.action_type }}</td>
              <td class="px-6 py-4">{{ (item.confidence * 100).toFixed(0) }}%</td>
              <td class="px-6 py-4 font-semibold">{{ formatSeconds(item.latency_seconds) }}</td>
              <td class="px-6 py-4">
                <span :class="item.decision === 'APPROVED' ? 'text-green-600' : 'text-red-600'" class="font-semibold">
                  {{ item.decision }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ formatTimestamp(item.proposed_at) }}</td>
            </tr>
            <tr v-if="latency.length === 0">
              <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                No latency data available. Make some decisions and rebuild analytics.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const health = ref<any[]>([]);
const velocity7d = ref<any[]>([]);
const performance = ref<any[]>([]);
const latency = ref<any[]>([]);
const latencySummary = ref<any>(null);
const rebuilding = ref(false);

async function fetchAnalytics() {
  try {
    const [healthRes, velocityRes, performanceRes, latencyRes] = await Promise.all([
      $fetch("/api/analytics/health"),
      $fetch("/api/analytics/velocity", { params: { windowDays: 7 } }),
      $fetch("/api/analytics/performance"),
      $fetch("/api/analytics/latency", { params: { limit: 20 } }),
    ]);

    health.value = (healthRes as any).data || [];
    velocity7d.value = (velocityRes as any).data || [];
    performance.value = (performanceRes as any).data || [];
    latency.value = (latencyRes as any).data || [];
    latencySummary.value = (latencyRes as any).summary || null;
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
  }
}

async function rebuildAnalytics() {
  rebuilding.value = true;
  try {
    await $fetch("/api/analytics/rebuild", { method: "POST" });
    await fetchAnalytics();
  } catch (error) {
    console.error("Failed to rebuild analytics:", error);
  } finally {
    rebuilding.value = false;
  }
}

function getHealthBadgeClass(status: string): string {
  switch (status) {
    case "CRITICAL":
    case "OUT_OF_STOCK":
      return "bg-red-100 text-red-800";
    case "LOW":
      return "bg-yellow-100 text-yellow-800";
    case "HEALTHY":
      return "bg-green-100 text-green-800";
    case "OVERSTOCKED":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "N/A";
  return new Date(ts).toLocaleString();
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "N/A";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

onMounted(() => {
  fetchAnalytics();
});
</script>
