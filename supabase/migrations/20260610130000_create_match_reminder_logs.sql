-- Stores de-duplicated reminder events (e.g., 30 minutes before kickoff).

BEGIN;

CREATE TABLE IF NOT EXISTS match_reminder_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_match_reminder_unique UNIQUE (match_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_match_reminder_logs_scheduled_for
  ON match_reminder_logs(scheduled_for);

COMMIT;
