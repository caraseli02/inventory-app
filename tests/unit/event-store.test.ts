import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as eventStore from '../../src/lib/event-store/store';
import { supabase } from '../../src/lib/supabase';

// Mock Supabase
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(),
      select: vi.fn(),
    })),
  },
}));

describe('EventStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEvent = {
    id: 'test-id',
    type: 'TestEvent',
    ts: '2023-01-01T00:00:00.000Z',
    aggregateType: 'TestAggregate',
    aggregateId: 'agg-1',
    payload: { foo: 'bar' },
  };

  const mockRow = {
    id: 'test-id',
    type: 'TestEvent',
    ts: '2023-01-01T00:00:00.000Z',
    aggregate_type: 'TestAggregate',
    aggregate_id: 'agg-1',
    payload: { foo: 'bar' },
  };

  describe('appendEvent', () => {
    it('should insert event into supabase', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
      // @ts-ignore
      supabase.from.mockImplementation(fromMock);

      await eventStore.appendEvent(mockEvent);

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(insertMock).toHaveBeenCalledWith({
        id: mockEvent.id,
        type: mockEvent.type,
        ts: mockEvent.ts,
        aggregate_type: mockEvent.aggregateType,
        aggregate_id: mockEvent.aggregateId,
        correlation_id: null,
        causation_id: null,
        payload: mockEvent.payload,
      });
    });

    it('should throw error if insert fails', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: { message: 'DB Error' } });
      const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
      // @ts-ignore
      supabase.from.mockImplementation(fromMock);

      await expect(eventStore.appendEvent(mockEvent)).rejects.toThrow('Failed to append event TestEvent: DB Error');
    });
  });

  describe('readEventsByType', () => {
    it('should select events by type', async () => {
      const orderMock = vi.fn().mockResolvedValue({ data: [mockRow], error: null });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      // @ts-ignore
      supabase.from.mockReturnValue({ select: selectMock });

      const events = await eventStore.readEventsByType('TestEvent');

      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('type', 'TestEvent');
      expect(orderMock).toHaveBeenCalledWith('ts', { ascending: true });
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(mockEvent);
    });
  });

  describe('createEventStore convenience wrapper', () => {
    it('should auto-generate id and ts on append', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      // @ts-ignore
      supabase.from.mockReturnValue({ insert: insertMock });

      const store = eventStore.createEventStore();
      const result = await store.append({
        type: 'TestEvent',
        aggregateType: 'TestAggregate',
        aggregateId: 'agg-1',
        payload: { foo: 'baz' },
      });

      expect(result.id).toBeDefined();
      expect(result.ts).toBeDefined();
      expect(result.payload).toEqual({ foo: 'baz' });
    });
  });
});
