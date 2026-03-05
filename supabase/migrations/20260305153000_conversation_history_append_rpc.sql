-- Migration: Atomic append for conversation_history.messages
-- Fixes read→append→upsert lost-update races under concurrent requests

CREATE OR REPLACE FUNCTION append_conversation_history(
  p_phone_number TEXT,
  p_messages JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_messages IS NULL OR jsonb_typeof(p_messages) <> 'array' THEN
    p_messages := '[]'::jsonb;
  END IF;

  INSERT INTO conversation_history (phone_number, messages)
  VALUES (p_phone_number, p_messages)
  ON CONFLICT (phone_number)
  DO UPDATE SET
    messages = (
      SELECT COALESCE(jsonb_agg(value ORDER BY ord), '[]'::jsonb)
      FROM (
        SELECT value, ord
        FROM jsonb_array_elements(
          COALESCE(conversation_history.messages, '[]'::jsonb)
          || COALESCE(EXCLUDED.messages, '[]'::jsonb)
        ) WITH ORDINALITY AS e(value, ord)
        ORDER BY ord DESC
        LIMIT 20
      ) last
    ),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION append_conversation_history(TEXT, JSONB) TO anon, authenticated;

