import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eventStore } from '../lib/event-store/store';
import type { EventEnvelope } from '../lib/event-store/types';

interface ProductHistoryProps {
  productId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPayload(event: EventEnvelope<string, any>, t: (key: string) => string) {
  switch (event.type) {
    case 'StockLevelChanged': {
      const { delta, reason } = event.payload;
      return (
        <span>
          {delta > 0 ? t('productHistory.added') : t('productHistory.removed')} <strong>{Math.abs(delta)}</strong> {t('productHistory.units')}
          <span className="text-gray-400 text-xs ml-2">({reason})</span>
        </span>
      );
    }
    case 'ProductCreated':
      return <span>{t('productHistory.created')} <strong>{event.payload.name}</strong></span>;
    case 'ProductUpdated': {
      // Show which fields changed
      const updates = event.payload.updates || {};
      const changedFields = Object.keys(updates).filter(k => k !== 'id').join(', ');
      return (
        <span>
          {t('productHistory.updated')} <strong>{changedFields || t('productHistory.none')}</strong>
          <span className="text-gray-400 text-xs ml-2">({t('productHistory.manualEdit')})</span>
        </span>
      );
    }
    case 'ActionProposed': {
      const { actionType, reason: proposalReason } = event.payload;
      return (
        <span className="text-purple-700">
          {t('productHistory.proposedAction')} <strong>{actionType}</strong>
          <br />
          <span className="text-gray-500 text-xs">{proposalReason}</span>
        </span>
      );
    }
    default:
      return (
        <pre className="whitespace-pre-wrap text-xs text-gray-500">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      );
  }
}

export function ProductHistory({ productId }: ProductHistoryProps) {
  const { t } = useTranslation();
  // 1. STATE: We need to store the events we fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<EventEnvelope<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. EFFECT: Fetch events when the component mounts or productId changes
  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      try {
        // --- STUDENT EXERCISE ---
        // TODO 1: Call eventStore.getEvents(productId)
        const history = await eventStore.getEvents(productId)

        // TODO 2: Update the 'events' state with the result
        setEvents(history);

        // (Optional) Console log the events to see what they look like!
        console.log('Product History:', history);

      } catch (error) {
        console.error('Failed to load history:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [productId]);

  if (loading) {
    return <div className="p-4 text-center text-gray-500">{t('productHistory.loading')}</div>;
  }

  if (events.length === 0) {
    return <div className="p-4 text-center text-gray-500">{t('productHistory.empty')}</div>;
  }

  // 3. RENDER: Display the events timeline
  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">{t('productHistory.title')}</h3>
      <div className="border-l-2 border-gray-200 ml-3 pl-6 space-y-6">
        {events.map((event) => (
          <div key={event.id} className="relative">
            {/* Timeline Dot */}
            <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white
              ${event.type === 'ActionProposed' ? 'bg-purple-500' : 'bg-blue-500'}
            `} />

            <div className="flex flex-col">
              <span className="text-xs text-gray-400">
                {new Date(event.ts).toLocaleString()}
              </span>
              <span className="font-medium text-gray-900">
                {/* Formatting the event type to look nicer */}
                {event.type.replace(/([A-Z])/g, ' $1').trim()}
              </span>

              {/* --- STUDENT EXERCISE --- */}
              {/* TODO 3: Render specific details based on event type */}
              <div className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                {renderPayload(event, t)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
