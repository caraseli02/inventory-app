-- Create the immutable event log table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT,
  causation_id TEXT,
  payload JSONB NOT NULL
);

-- Indices for common access patterns
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events (aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE events;
