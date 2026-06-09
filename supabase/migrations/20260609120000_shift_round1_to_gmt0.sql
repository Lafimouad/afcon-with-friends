-- Shift World Cup 2026 first-round kickoff times from GMT+1 to GMT+0.
-- Run once on the target database.

BEGIN;

UPDATE matches
SET match_date = match_date - interval '1 hour'
WHERE round = 1
  AND stage = 'group_stage'
  AND match_date >= timestamptz '2026-06-11 00:00:00+00'
  AND match_date < timestamptz '2026-06-19 00:00:00+00';

COMMIT;

-- Optional verification:
-- SELECT round, stage, match_date
-- FROM matches
-- WHERE round = 1
-- ORDER BY match_date;
