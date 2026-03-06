import fs from 'node:fs';
import path from 'node:path';

const distAssetsDir = path.resolve('dist/assets');

if (!fs.existsSync(distAssetsDir)) {
  console.error('[bundle-budget] dist/assets not found. Run `pnpm build` first.');
  process.exit(1);
}

const files = fs.readdirSync(distAssetsDir);
const jsFiles = files.filter((file) => file.endsWith('.js'));
const cssFiles = files.filter((file) => file.endsWith('.css'));

const statSize = (file) => fs.statSync(path.join(distAssetsDir, file)).size;
const firstMatchingSize = (prefix, list) => {
  const match = list.find((file) => file.startsWith(prefix));
  return match ? statSize(match) : null;
};

const budgets = {
  maxInventoryChunkBytes: Number(process.env.BUDGET_INVENTORY_CHUNK_BYTES ?? 530_000),
  maxOrdersChunkBytes: Number(process.env.BUDGET_ORDERS_CHUNK_BYTES ?? 20_000),
  maxIndexCssBytes: Number(process.env.BUDGET_INDEX_CSS_BYTES ?? 145_000),
  maxTotalJsBytes: Number(process.env.BUDGET_TOTAL_JS_BYTES ?? 2_060_000),
};

const metrics = {
  inventoryChunkBytes: firstMatchingSize('InventoryListPage-', jsFiles),
  ordersChunkBytes: firstMatchingSize('OrdersPage-', jsFiles),
  indexCssBytes: firstMatchingSize('index-', cssFiles),
  totalJsBytes: jsFiles.reduce((sum, file) => sum + statSize(file), 0),
};

const checks = [
  {
    key: 'inventoryChunkBytes',
    label: 'InventoryListPage chunk',
    current: metrics.inventoryChunkBytes,
    budget: budgets.maxInventoryChunkBytes,
  },
  {
    key: 'ordersChunkBytes',
    label: 'OrdersPage chunk',
    current: metrics.ordersChunkBytes,
    budget: budgets.maxOrdersChunkBytes,
  },
  {
    key: 'indexCssBytes',
    label: 'index.css bundle',
    current: metrics.indexCssBytes,
    budget: budgets.maxIndexCssBytes,
  },
  {
    key: 'totalJsBytes',
    label: 'total emitted JS',
    current: metrics.totalJsBytes,
    budget: budgets.maxTotalJsBytes,
  },
];

const failures = [];
for (const check of checks) {
  if (check.current === null) {
    failures.push(`${check.label}: chunk not found`);
    continue;
  }
  if (check.current > check.budget) {
    failures.push(`${check.label}: ${check.current} B > ${check.budget} B`);
  }
}

const topJs = jsFiles
  .map((file) => ({ file, size: statSize(file) }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 8);

console.log('[bundle-budget] measured metrics:');
for (const check of checks) {
  console.log(`- ${check.label}: ${check.current ?? 'missing'} B (budget ${check.budget} B)`);
}
console.log('[bundle-budget] largest JS chunks:');
for (const chunk of topJs) {
  console.log(`- ${chunk.file}: ${chunk.size} B`);
}

if (failures.length > 0) {
  console.error('[bundle-budget] failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[bundle-budget] OK');
