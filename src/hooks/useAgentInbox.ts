
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { eventStore } from '../lib/event-store/store';
import { ActionProposedPayload } from '../lib/event-store/types';

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
      const proposals = allEvents.filter(e => e.type === 'ActionProposed');
      const decisions = allEvents.filter(e => e.type === 'HumanDecisionRecorded');

      // 3. Create a Set of Resolved Action IDs
      const resolvedActionIds = new Set(
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
      const pendingProposals = proposals.filter((p: any) => {
        const payload = p.payload as ActionProposedPayload;
        // Filter 1: Not resolved
        if (resolvedActionIds.has(payload.actionId)) return false;
        // Filter 2: Product still exists (Orphan check)
        if (!productMap.has(payload.productId)) return false;

        return true;
      });

      // 5. Map to Inbox Items AND Deduplicate
      // We might have spam from before the Idempotency fix. 
      // We only want the LATEST pending action per product + actionType.

      const inboxItemsMap = new Map<string, InboxItem>();

      pendingProposals.forEach(p => {
        const payload = p.payload as ActionProposedPayload;
        const productName = productMap.get(payload.productId) || 'Unknown Product';
        const key = `${payload.productId}-${payload.actionType}`;
        const item: InboxItem = {
          id: payload.actionId,
          type: payload.actionType,
          productId: payload.productId,
          productName,
          reason: payload.reason,
          confidence: payload.confidence,
          timestamp: p.ts,
          payload
        };

        // If we already have one, keep the newer one? The loop order depends on `allEvents`.
        // `allEvents` is usually chronological. So later items replace earlier ones.
        inboxItemsMap.set(key, item);
      });

      const uniqueInboxItems = Array.from(inboxItemsMap.values());

      // Sort by newest first
      setItems(uniqueInboxItems.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));

    } catch (err: any) {
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
