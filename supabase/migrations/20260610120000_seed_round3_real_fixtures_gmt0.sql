-- Seed real World Cup 2026 Round 3 fixtures in GMT+0.
-- Requires teams from the Round 1 real fixtures seed.

BEGIN;

-- Replace round 3 fixtures safely when rerun.
DELETE FROM predictions
WHERE match_id IN (SELECT id FROM matches WHERE round = 3);

DELETE FROM matches
WHERE round = 3;

WITH fixtures(home_team, away_team, kickoff_utc) AS (
  VALUES
    ('Bosnia & Herzegovina', 'Qatar', timestamptz '2026-06-24 20:00:00+00'),
    ('Switzerland', 'Canada', timestamptz '2026-06-24 20:00:00+00'),
    ('Morocco', 'Haiti', timestamptz '2026-06-24 23:00:00+00'),
    ('Scotland', 'Brazil', timestamptz '2026-06-24 23:00:00+00'),
    ('Czech Republic', 'Mexico', timestamptz '2026-06-25 02:00:00+00'),
    ('South Africa', 'South Korea', timestamptz '2026-06-25 02:00:00+00'),
    ('Curacao', 'Ivory Coast', timestamptz '2026-06-25 21:00:00+00'),
    ('Ecuador', 'Germany', timestamptz '2026-06-25 21:00:00+00'),
    ('Japan', 'Sweden', timestamptz '2026-06-26 00:00:00+00'),
    ('Tunisia', 'Netherlands', timestamptz '2026-06-26 00:00:00+00'),
    ('Paraguay', 'Australia', timestamptz '2026-06-26 03:00:00+00'),
    ('Turkey', 'USA', timestamptz '2026-06-26 03:00:00+00'),
    ('Norway', 'France', timestamptz '2026-06-26 20:00:00+00'),
    ('Senegal', 'Iraq', timestamptz '2026-06-26 20:00:00+00'),
    ('Cape Verde', 'Saudi Arabia', timestamptz '2026-06-27 01:00:00+00'),
    ('Uruguay', 'Spain', timestamptz '2026-06-27 01:00:00+00'),
    ('Egypt', 'Iran', timestamptz '2026-06-27 04:00:00+00'),
    ('New Zealand', 'Belgium', timestamptz '2026-06-27 04:00:00+00'),
    ('Croatia', 'Ghana', timestamptz '2026-06-27 22:00:00+00'),
    ('Panama', 'England', timestamptz '2026-06-27 22:00:00+00'),
    ('Colombia', 'Portugal', timestamptz '2026-06-28 00:30:00+00'),
    ('DR Congo', 'Uzbekistan', timestamptz '2026-06-28 00:30:00+00'),
    ('Algeria', 'Austria', timestamptz '2026-06-28 03:00:00+00'),
    ('Jordan', 'Argentina', timestamptz '2026-06-28 03:00:00+00')
)
INSERT INTO matches (
  home_team_id,
  away_team_id,
  match_date,
  round,
  stage,
  group_name,
  is_completed
)
SELECT
  ht.id,
  at.id,
  f.kickoff_utc,
  3,
  'group_stage',
  NULL,
  false
FROM fixtures f
JOIN teams ht ON ht.name = f.home_team
JOIN teams at ON at.name = f.away_team
ORDER BY f.kickoff_utc;

COMMIT;
