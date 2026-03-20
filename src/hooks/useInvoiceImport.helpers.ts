import type { TFunction } from 'i18next';
import type { InvoiceProduct } from '@/lib/invoiceOCR';

export const NUMERIC_EDITABLE_FIELDS: ReadonlySet<string> = new Set([
  'quantity',
  'unitPrice',
  'totalPrice',
  'weightKg',
]);

export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && Number.isFinite(value);
}

export const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
};

export const normalizeForMatch = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

export const inferCategoryFromName = (name: string): string => {
  const normalized = name.toLowerCase();
  const rules: Array<{ category: string; keywords: string[] }> = [
    { category: 'Dairy', keywords: ['milk', 'cheese', 'yogurt', 'butter', 'smantana'] },
    { category: 'Meat', keywords: ['beef', 'pork', 'chicken', 'meat', 'carne'] },
    { category: 'Produce', keywords: ['apple', 'banana', 'tomato', 'potato', 'fruit', 'vegetable', 'legume'] },
    { category: 'Beverages', keywords: ['water', 'juice', 'soda', 'cola', 'beer', 'wine', 'drink', 'baut'] },
    { category: 'Snacks', keywords: ['chips', 'snack', 'cracker', 'biscuit', 'cookie'] },
    { category: 'Pantry', keywords: ['rice', 'pasta', 'flour', 'sugar', 'salt', 'oil'] },
    { category: 'Household', keywords: ['soap', 'detergent', 'clean', 'paper', 'towel'] },
    { category: 'Conserve', keywords: ['canned', 'conserve'] },
    { category: 'Cereale', keywords: ['cereal', 'oat', 'granola'] },
  ];
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }
  return 'General';
};

export const getPreviewId = (product: InvoiceProduct, index: number): string => {
  const rowId = product.rowId?.trim();
  if (rowId) return `row:${rowId}:idx:${index}`;
  return `idx:${index}`;
};

export function buildImportErrorMessage(err: unknown, t: TFunction): string {
  const base = t('invoiceUpload.errors.importFailed', 'Import failed. ');
  if (!(err instanceof Error)) return base;
  if (err.message.includes('network') || err.message.includes('fetch')) {
    return base + t('invoiceUpload.errors.networkRetry', 'Network error occurred. Please check your connection and try again.');
  }
  if (err.message.includes('quota') || err.message.includes('rate limit')) {
    return base + t('invoiceUpload.errors.rateLimit', 'Rate limit exceeded. Please wait a moment and try again.');
  }
  if (err.message.includes('validation')) return base + err.message;
  return base + t('invoiceUpload.errors.generic', 'Please try again or contact support if the issue persists.');
}

export function buildProcessErrorMessage(err: unknown, t: TFunction): string {
  const base = t('invoiceUpload.errors.processFailed', 'Failed to process invoice. ');
  if (!(err instanceof Error)) {
    return base + t('invoiceUpload.errors.generic', 'Please try again or contact support if the issue persists.');
  }
  if (err.message.includes('API key')) return base + t('invoiceUpload.errors.apiKey', 'Please check your API configuration.');
  if (err.message.includes('network') || err.message.includes('fetch')) {
    return base + t('invoiceUpload.errors.network', 'Please check your internet connection and try again.');
  }
  if (err.message.includes('quota') || err.message.includes('rate limit')) {
    return base + t('invoiceUpload.errors.quota', 'Service limit reached. Please try again later.');
  }
  return base + err.message;
}
