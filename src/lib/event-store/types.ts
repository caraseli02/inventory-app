import { z } from "zod";

/**
 * Standard envelope for all domain events.
 * 
 * @template TType - The string literal type of the event (e.g., "ProductCreated")
 * @template TPayload - The shape of the event payload
 */
export type EventEnvelope<TType extends string, TPayload> = {
  id: string;             // UUID
  type: TType;            // Event name
  ts: string;             // ISO-8601 timestamp
  aggregateType: string;  // e.g., "Product"
  aggregateId: string;    // UUID of the entity
  correlationId?: string; // For tracing workflows
  causationId?: string;   // ID of the event that caused this one
  payload: TPayload;      // The actual event data
};

// --- Domain Event Payload Schemas ---

export const ProductCreatedPayload = z.object({
  productId: z.string(),
  name: z.string(),
  initialPriceCents: z.number().int(),
});
export type ProductCreatedPayload = z.infer<typeof ProductCreatedPayload>;

export const StockLevelChangedPayload = z.object({
  productId: z.string(),
  delta: z.number().int(),
  reason: z.enum(["SALE", "DELIVERY", "ADJUSTMENT", "RETURN", "INITIAL"]),
  threshold: z.number().int().positive().optional(), // Low stock threshold
  source: z.string().optional(),
});
export type StockLevelChangedPayload = z.infer<typeof StockLevelChangedPayload>;

export const ProductUpdatedPayload = z.object({
  productId: z.string(),
  updates: z.record(z.string(), z.any()), // Flexible for now
  reason: z.string().optional(),
});
export type ProductUpdatedPayload = z.infer<typeof ProductUpdatedPayload>;

export const ActionProposedPayload = z.object({
  actionId: z.string(),
  productId: z.string(),
  actionType: z.enum(["REORDER", "PRICE_INCREASE", "PRICE_DECREASE"]),
  suggestedValueCents: z.number().int(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  experimentId: z.string().optional(),
  variant: z.string().optional(),
});
export type ActionProposedPayload = z.infer<typeof ActionProposedPayload>;

export const HumanDecisionRecordedPayload = z.object({
  actionId: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewerId: z.string(),
});
export type HumanDecisionRecordedPayload = z.infer<typeof HumanDecisionRecordedPayload>;
