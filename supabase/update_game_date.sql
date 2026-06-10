-- Update one game date/time (GMT+0) safely.
-- Run in Supabase SQL Editor.

BEGIN;

-- 1) Preview the match you want to edit.
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

-- 2) Update the kickoff date/time (UTC/GMT+0).
-- Replace the filter and new timestamp as needed.
UPDATE matches m
SET match_date = timestamptz '2026-06-11 19:30:00+00'
FROM teams ht, teams at
WHERE m.home_team_id = ht.id
  AND m.away_team_id = at.id
  AND m.round = 1
  AND ht.name = 'Mexico'
  AND at.name = 'South Africa';

-- 3) Verify result.
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
-- If you already know the match id, you can use this simpler update:
-- UPDATE matches SET match_date = timestamptz '2026-06-11 19:30:00+00' WHERE id = '<match-uuid>';
