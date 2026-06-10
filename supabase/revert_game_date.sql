-- Revert one game date/time back to original value (GMT+0).
-- Run in Supabase SQL Editor.

BEGIN;

-- 1) Preview current value.
-- Example: Mexico vs South Africa in Round 1
SELECT
  m.id,
  m.round,
  m.stage,
  m.match_date,
  ht.name AS home_team,
  at.name AS away_team
FROM matches m
JOIN teams ht ON ht.id = m.home_team_id
JOIN teams at ON at.id = m.away_team_id
WHERE m.round = 1
  AND ht.name = 'Mexico'
  AND at.name = 'South Africa';

-- 2) Revert kickoff date/time to original value.
UPDATE matches m
SET match_date = timestamptz '2026-06-11 19:00:00+00'
FROM teams ht, teams at
WHERE m.home_team_id = ht.id
  AND m.away_team_id = at.id
  AND m.round = 1
  AND ht.name = 'Mexico'
  AND at.name = 'South Africa';

-- 3) Verify reverted value.
SELECT
  m.id,
  m.round,
  m.stage,
  m.match_date,
  ht.name AS home_team,
  at.name AS away_team
FROM matches m
JOIN teams ht ON ht.id = m.home_team_id
JOIN teams at ON at.id = m.away_team_id
WHERE m.round = 1
  AND ht.name = 'Mexico'
  AND at.name = 'South Africa';

COMMIT;

-- Tip:
-- If you already know match id, use:
-- UPDATE matches SET match_date = timestamptz '2026-06-11 19:00:00+00' WHERE id = '<match-uuid>';
