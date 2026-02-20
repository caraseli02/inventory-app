/**
 * Types for WhatsApp AI Agent pickup orders feature
 * Spec: docs/specs/whatsapp_agent.md
 */

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface OrderItem {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
}

export interface Order {
  id: string;
  order_number: string;       // e.g. "ORD-047"
  customer_name: string;
  customer_phone: string;     // WhatsApp phone in E.164 format
  items: OrderItem[];
  total_price: number;
  pickup_time: string | null; // free text from customer e.g. "tomorrow 10am"
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  total_price: number;
  pickup_time?: string;
  notes?: string;
}

export interface UpdateOrderStatusInput {
  id: string;
  status: OrderStatus;
}
