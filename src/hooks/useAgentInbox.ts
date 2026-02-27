
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { eventStore } from '../lib/event-store/store';
import { ActionProposedPayload, type EventEnvelope } from '../lib/event-store/types';

export interface InboxItem {
  id: string; // The Action ID
  type: 'REORDER' | 'PRICE_INCREASE' | 'PRICE_DECREASE';
  productId: string;
  productName: string;
  reason: string;
  confidence: number;
  timestamp: string;
  payload: ActionProposedPayload;
}

function buildInboxItems(
  pendingProposals: EventEnvelope<'ActionProposed', ActionProposedPayload>[],
  productMap: Map<string, string>
): InboxItem[] {
  const inboxItemsMap = new Map<string, InboxItem>();
  pendingProposals.forEach(p => {
    const payload = p.payload as ActionProposedPayload;
    const key = `${payload.productId}-${payload.actionType}`;
    inboxItemsMap.set(key, {
      id: payload.actionId,
      type: payload.actionType,
      productId: payload.productId,
      productName: productMap.get(payload.productId) || 'Unknown Product',
      reason: payload.reason,
      confidence: payload.confidence,
      timestamp: p.ts,
      payload,
    });
  });
  return Array.from(inboxItemsMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function useAgentInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch RAW Event Log (Client-side Projection)
      const allEvents = await eventStore.getAllEvents();

      // 2. Filter for Proposals and Decisions
      const proposals = allEvents.filter(e => e.type === 'ActionProposed') as EventEnvelope<'ActionProposed', ActionProposedPayload>[];
      const decisions = allEvents.filter(e => e.type === 'HumanDecisionRecorded');

      // 3. Create a Set of Resolved Action IDs
      const resolvedActionIds = new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decisions.map(d => (d.payload as any).actionId)
      );

      // 3.1 Fetch Product Details (to get Names and check existence)
      // This solves "Orphan Handling" (deleted products) AND "Product Name Display"
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name');

      if (prodError) throw prodError;

      // Explicitly type the products list to avoid inference issues
      const productsList: { id: string; name: string }[] = products || [];
      const productMap = new Map<string, string>(productsList.map(p => [p.id, p.name]));

      // 4. Derive "Pending" State
      const pendingProposals = proposals.filter(p => {
        const payload = p.payload as ActionProposedPayload;
        // Filter 1: Not resolved
        if (resolvedActionIds.has(payload.actionId)) return false;
        // Filter 2: Product still exists (Orphan check)
        if (!productMap.has(payload.productId)) return false;

        return true;
      });

      // 5. Map to Inbox Items, deduplicate, sort newest-first
      setItems(buildInboxItems(pendingProposals, productMap));

    } catch (err) {
      console.error('Failed to fetch inbox:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const respond = async (actionId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      // Optimistic update
      setItems(prev => prev.filter(i => i.id !== actionId));

      await eventStore.append({
        type: 'HumanDecisionRecorded',
        aggregateType: 'Action',
        aggregateId: actionId,
        payload: {
          actionId,
          decision,
          reviewerId: 'manager-1' // Hardcoded for MVP
        }
      });

      // Ideally we re-fetch to be sure, but optimistic is fine for now
    } catch (err) {
      console.error(`Failed to ${decision} action:`, err);
      // Revert on error would go here
      fetchInbox(); // Fallback
    }
  };

  return {
    items,
    loading,
    error,
    refresh: fetchInbox,
    approve: (id: string) => respond(id, 'APPROVED'),
    reject: (id: string) => respond(id, 'REJECTED'),
  };
}
