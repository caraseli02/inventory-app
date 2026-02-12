import type { CartItem, Product } from '@/types';
import { logger } from '@/lib/logger';

export const CHECKOUT_CART_STORAGE_KEY = 'checkoutCart:v1';

const VERSION = 1 as const;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const MAX_ITEMS = 200;
const MAX_JSON_CHARS = 250_000; // soft cap; prevents quota blowups on big Product snapshots

type PersistedCheckoutCartV1 = {
  version: typeof VERSION;
  updatedAt: string;
  expiresAt: string;
  items: Array<{ product: Product; quantity: number }>;
};

function nowIso() {
  return new Date().toISOString();
}

function isFinitePositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isProductLike(value: unknown): value is Product {
  if (!isRecord(value)) return false;
  const id = value.id;
  const createdTime = value.createdTime;
  const fields = value.fields;
  if (typeof id !== 'string') return false;
  if (typeof createdTime !== 'string') return false;
  if (!isRecord(fields)) return false;
  return typeof fields.Name === 'string';
}

function normalizeItems(input: unknown): PersistedCheckoutCartV1['items'] {
  if (!Array.isArray(input)) return [];

  const out: PersistedCheckoutCartV1['items'] = [];
  for (const row of input) {
    if (!isRecord(row)) continue;
    const product = row.product;
    const quantity = row.quantity;
    if (!isProductLike(product)) continue;
    if (!isFinitePositiveInt(quantity)) continue;
    out.push({ product, quantity });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export function loadPersistedCheckoutCart(): Array<{ product: Product; quantity: number }> | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_CART_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedCheckoutCartV1;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== VERSION) return null;
    if (typeof parsed.expiresAt !== 'string') return null;

    const expiresAtMs = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
      localStorage.removeItem(CHECKOUT_CART_STORAGE_KEY);
      return null;
    }

    const items = normalizeItems((parsed as unknown as Record<string, unknown>).items);
    if (items.length === 0) return null;
    return items;
  } catch (error) {
    logger.warn('Failed to load persisted checkout cart from localStorage', {
      key: CHECKOUT_CART_STORAGE_KEY,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
    try {
      localStorage.removeItem(CHECKOUT_CART_STORAGE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

export function persistCheckoutCart(cart: CartItem[]) {
  try {
    if (!cart || cart.length === 0) {
      localStorage.removeItem(CHECKOUT_CART_STORAGE_KEY);
      return;
    }

    const items = cart
      .map((item) => ({ product: item.product, quantity: item.quantity }))
      .slice(0, MAX_ITEMS);

    const payload: PersistedCheckoutCartV1 = {
      version: VERSION,
      updatedAt: nowIso(),
      expiresAt: new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
      items,
    };

    const json = JSON.stringify(payload);
    if (json.length > MAX_JSON_CHARS) {
      logger.warn('Skipping checkout cart persistence due to size cap', {
        key: CHECKOUT_CART_STORAGE_KEY,
        jsonChars: json.length,
        maxJsonChars: MAX_JSON_CHARS,
        itemsCount: items.length,
      });
      return;
    }

    localStorage.setItem(CHECKOUT_CART_STORAGE_KEY, json);
  } catch (error) {
    logger.warn('Failed to persist checkout cart to localStorage', {
      key: CHECKOUT_CART_STORAGE_KEY,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      isQuotaError: error instanceof DOMException && error.name === 'QuotaExceededError',
    });
  }
}

export function clearPersistedCheckoutCart() {
  try {
    localStorage.removeItem(CHECKOUT_CART_STORAGE_KEY);
  } catch (error) {
    logger.warn('Failed to clear persisted checkout cart', {
      key: CHECKOUT_CART_STORAGE_KEY,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
  }
}
