export interface TwilioBody {
  From?: string;
  Body?: string;
  ProfileName?: string;
  To?: string;
  MessageSid?: string;
  NumMedia?: string;
  ButtonPayload?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type IncomingIntent = 'store_info' | 'browse_inventory' | 'product_query' | 'cancel_order' | 'greeting' | 'reset';

export interface PendingOrder {
  customer_name: string;
  customer_phone: string;
  items: Array<{ product_id: string; name: string; qty: number; unit_price: number }>;
  total_price: number;
  pickup_time: string | null;
  pending_order_created_at?: string;
}

export type WhatsAppSimulatorProvider = 'openai' | 'anthropic' | 'local';

export interface WhatsAppSimulatorTransaction {
  status:
    | 'reply'
    | 'pending_confirmation'
    | 'confirmed'
    | 'cancelled'
    | 'expired'
    | 'already_confirmed'
    | 'already_exists_cannot_cancel';
  orderNumber?: string;
}

export interface WhatsAppSimulatorResult {
  provider: WhatsAppSimulatorProvider;
  reply: string;
  pending?: PendingOrder;
  listPicker?: string[];
  transaction?: WhatsAppSimulatorTransaction;
  debug?: {
    intent: IncomingIntent;
    inventoryText?: string;
    searchCandidatesCurrent?: string[];
    searchCandidatesFromHistory?: string[];
    searchCandidatesUsed?: string[];
    repairedOrder?: boolean;
  };
}
