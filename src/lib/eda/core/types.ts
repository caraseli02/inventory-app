import { z } from "zod";
import type { Json } from "../../database.types";

export type EventEnvelope<TType extends string, TPayload extends Json> = {
  id: string;
  type: TType;
  ts: string;
  aggregateType: string;
  aggregateId: string;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
};

export const StockLevelChangedPayload = z.object({
  productId: z.string(),
  delta: z.number().int(),
  reason: z.enum(["SALE", "DELIVERY", "ADJUSTMENT"]),
  threshold: z.number().int().positive().optional(),
  source: z.string().optional(),
});

export type StockLevelChangedPayload = z.infer<typeof StockLevelChangedPayload>;

export const ActionProposedPayload = z.object({
  actionId: z.string(),
  productId: z.string(),
  actionType: z.enum(["REORDER", "PRICE_INCREASE", "PRICE_DECREASE"]),
  suggestedValueCents: z.number().int(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  experimentId: z.string(),
  variant: z.string(),
});

export type ActionProposedPayload = z.infer<typeof ActionProposedPayload>;

export const HumanDecisionRecordedPayload = z.object({
  actionId: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewerId: z.string(),
});

export type HumanDecisionRecordedPayload = z.infer<typeof HumanDecisionRecordedPayload>;

export const ProductDiscontinuedPayload = z.object({
  productId: z.string(),
  reason: z.string(),
  discontinuedBy: z.string(),
});

export type ProductDiscontinuedPayload = z.infer<typeof ProductDiscontinuedPayload>;
