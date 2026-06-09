-- Seed real World Cup 2026 Round 2 fixtures in GMT+0.
-- Requires teams from the Round 1 real fixtures seed.

BEGIN;

-- Replace round 2 fixtures safely when rerun.
DELETE FROM predictions
WHERE match_id IN (SELECT id FROM matches WHERE round = 2);

DELETE FROM matches
WHERE round = 2;

WITH fixtures(home_team, away_team, kickoff_utc) AS (
  VALUES
    ('Czech Republic', 'South Africa', timestamptz '2026-06-18 17:00:00+00'),
    ('Switzerland', 'Bosnia & Herzegovina', timestamptz '2026-06-18 20:00:00+00'),
    ('Canada', 'Qatar', timestamptz '2026-06-18 23:00:00+00'),
    ('Mexico', 'South Korea', timestamptz '2026-06-19 02:00:00+00'),
    ('USA', 'Australia', timestamptz '2026-06-19 20:00:00+00'),
    ('Scotland', 'Morocco', timestamptz '2026-06-19 23:00:00+00'),
    ('Brazil', 'Haiti', timestamptz '2026-06-20 01:30:00+00'),
    ('Turkey', 'Paraguay', timestamptz '2026-06-20 04:00:00+00'),
    ('Netherlands', 'Sweden', timestamptz '2026-06-20 18:00:00+00'),
    ('Germany', 'Ivory Coast', timestamptz '2026-06-20 21:00:00+00'),
    ('Ecuador', 'Curacao', timestamptz '2026-06-21 01:00:00+00'),
    ('Tunisia', 'Japan', timestamptz '2026-06-21 05:00:00+00'),
    ('Spain', 'Saudi Arabia', timestamptz '2026-06-21 17:00:00+00'),
    ('Belgium', 'Iran', timestamptz '2026-06-21 20:00:00+00'),
    ('Uruguay', 'Cape Verde', timestamptz '2026-06-21 23:00:00+00'),
    ('New Zealand', 'Egypt', timestamptz '2026-06-22 02:00:00+00'),
    ('Argentina', 'Austria', timestamptz '2026-06-22 18:00:00+00'),
    ('France', 'Iraq', timestamptz '2026-06-22 22:00:00+00'),
    ('Norway', 'Senegal', timestamptz '2026-06-23 01:00:00+00'),
    ('Jordan', 'Algeria', timestamptz '2026-06-23 04:00:00+00'),
    ('Portugal', 'Uzbekistan', timestamptz '2026-06-23 18:00:00+00'),
    ('England', 'Ghana', timestamptz '2026-06-23 21:00:00+00'),
    ('Panama', 'Croatia', timestamptz '2026-06-24 00:00:00+00'),
    ('Colombia', 'DR Congo', timestamptz '2026-06-24 03:00:00+00')
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
  2,
  'group_stage',
  NULL,
  false
FROM fixtures f
JOIN teams ht ON ht.name = f.home_team
JOIN teams at ON at.name = f.away_team
ORDER BY f.kickoff_utc;

COMMIT;
