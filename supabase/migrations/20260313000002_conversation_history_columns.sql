-- Explicitly declare pending_order column (fixes schema drift — was used in code but missing from migration)
ALTER TABLE conversation_history ADD COLUMN IF NOT EXISTS pending_order JSONB DEFAULT NULL;

-- Store preferred language per conversation (avoids per-turn regex loanword false-positives)
ALTER TABLE conversation_history ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ro';

-- Store pending product selection for template-based disambiguation flow
ALTER TABLE conversation_history ADD COLUMN IF NOT EXISTS pending_selection JSONB DEFAULT NULL;
