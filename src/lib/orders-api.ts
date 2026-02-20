/**
 * Orders API — CRUD operations for WhatsApp pickup orders
 * Spec: docs/specs/whatsapp_agent.md
 *
 * Key rule (R06b): Stock is deducted ONLY on order confirmation, never on creation.
 */

import { supabase } from './supabase';
import { addStockMovement } from './supabase-api';
import { logger } from './logger';
import type { Order, CreateOrderInput, OrderStatus } from '../types/orders';

// The `orders` table is added via migration 20260220000000_create_orders_tables.sql.
// Until `database.types.ts` is regenerated after migration, we use a typed helper
// to avoid Supabase client type errors on the new table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch all orders, newest first.
 * Optionally filter by status.
 */
export const getOrders = async (status?: OrderStatus): Promise<Order[]> => {
  let query = db
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch orders', { error: error.message });
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return (data ?? []) as Order[];
};

/**
 * Fetch a single order by ID.
 */
export const getOrderById = async (id: string): Promise<Order | null> => {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch order', { id, error: error.message });
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  return data as Order | null;
};

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a new pickup order (status: pending).
 * Does NOT touch stock — stock only moves on confirmation (R06b).
 */
export const createOrder = async (input: CreateOrderInput): Promise<Order> => {
  const { data, error } = await db
    .from('orders')
    .insert({
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      items: input.items,
      total_price: input.total_price,
      pickup_time: input.pickup_time ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create order', { error: error.message, input });
    throw new Error(`Failed to create order: ${error.message}`);
  }

  logger.info('Order created', { order_number: (data as Order).order_number });
  return data as Order;
};

// ─── Confirm ──────────────────────────────────────────────────────────────────

/**
 * Confirm a pending order.
 * This is the ONLY place stock deduction happens (R06b).
 * Each order item triggers an OUT stock movement.
 */
export const confirmOrder = async (id: string): Promise<Order> => {
  // 1. Fetch order to get items
  const order = await getOrderById(id);
  if (!order) throw new Error(`Order ${id} not found`);
  if (order.status !== 'pending') {
    throw new Error(`Order ${order.order_number} is already ${order.status}`);
  }

  // 2. Deduct stock for each item (OUT movement)
  logger.info('Confirming order — deducting stock', {
    order_number: order.order_number,
    items: order.items,
  });

  for (const item of order.items) {
    await addStockMovement(item.product_id, item.qty, 'OUT');
  }

  // 3. Update order status to confirmed
  const { data, error } = await db
    .from('orders')
    .update({ status: 'confirmed' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to confirm order', { id, error: error.message });
    throw new Error(`Failed to confirm order: ${error.message}`);
  }

  logger.info('Order confirmed', { order_number: order.order_number });
  return data as Order;
};

// ─── Cancel ───────────────────────────────────────────────────────────────────

/**
 * Cancel a pending order.
 * No stock movements — nothing was deducted yet (R06b).
 */
export const cancelOrder = async (id: string): Promise<Order> => {
  const order = await getOrderById(id);
  if (!order) throw new Error(`Order ${id} not found`);
  if (order.status !== 'pending') {
    throw new Error(`Order ${order.order_number} is already ${order.status}`);
  }

  const { data, error } = await db
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to cancel order', { id, error: error.message });
    throw new Error(`Failed to cancel order: ${error.message}`);
  }

  logger.info('Order cancelled', { order_number: order.order_number });
  return data as Order;
};

// ─── Complete ─────────────────────────────────────────────────────────────────

/**
 * Mark a confirmed order as completed (customer picked up).
 */
export const completeOrder = async (id: string): Promise<Order> => {
  const { data, error } = await db
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to complete order', { id, error: error.message });
    throw new Error(`Failed to complete order: ${error.message}`);
  }

  return data as Order;
};
