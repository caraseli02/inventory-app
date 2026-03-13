-- Deduplication table for Twilio webhook retries (prevents duplicate processing)
CREATE TABLE IF NOT EXISTS processed_message_sids (
  message_sid  TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for TTL-based cleanup queries
CREATE INDEX IF NOT EXISTS processed_message_sids_processed_at_idx
  ON processed_message_sids (processed_at);

-- Per-phone rate limiting table (10 messages per 60-second window)
CREATE TABLE IF NOT EXISTS whatsapp_rate_limits (
  phone_number  TEXT PRIMARY KEY,
  message_count INT NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now()
);
