-- Atomic consume of pending_order — prevents double-confirm race condition.
-- Reads and clears pending_order in a single FOR UPDATE transaction.
CREATE OR REPLACE FUNCTION consume_pending_order(p_phone TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_order JSONB;
BEGIN
  SELECT pending_order INTO v_order
  FROM conversation_history
  WHERE phone_number = p_phone
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE conversation_history
  SET pending_order = NULL,
      updated_at    = now()
  WHERE phone_number = p_phone;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION consume_pending_order(TEXT) TO anon, authenticated;
