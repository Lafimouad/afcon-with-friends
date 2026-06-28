-- Seed World Cup 2026 Round of 16 (1/16-Finals) fixtures in GMT+0.

BEGIN;


WITH fixtures(home_team, away_team, kickoff_utc) AS (
  VALUES
    ('South Africa',        'Canada',               timestamptz '2026-06-28 19:00:00+00'),
    ('Brazil',              'Japan',                timestamptz '2026-06-29 17:00:00+00'),
    ('Germany',             'Paraguay',             timestamptz '2026-06-29 20:30:00+00'),
    ('Netherlands',         'Morocco',              timestamptz '2026-06-30 01:00:00+00'),
    ('Ivory Coast',         'Norway',               timestamptz '2026-06-30 17:00:00+00'),
    ('France',              'Sweden',               timestamptz '2026-06-30 21:00:00+00'),
    ('Mexico',              'Ecuador',              timestamptz '2026-07-01 01:00:00+00'),
    ('England',             'DR Congo',             timestamptz '2026-07-01 16:00:00+00'),
    ('Belgium',             'Senegal',              timestamptz '2026-07-01 20:00:00+00'),
    ('USA',                 'Bosnia & Herzegovina', timestamptz '2026-07-02 00:00:00+00'),
    ('Spain',               'Austria',              timestamptz '2026-07-02 19:00:00+00'),
    ('Portugal',            'Croatia',              timestamptz '2026-07-02 23:00:00+00'),
    ('Switzerland',         'Algeria',              timestamptz '2026-07-03 03:00:00+00'),
    ('Australia',           'Egypt',                timestamptz '2026-07-03 18:00:00+00'),
    ('Argentina',           'Cape Verde',           timestamptz '2026-07-03 22:00:00+00'),
    ('Colombia',            'Ghana',                timestamptz '2026-07-04 01:30:00+00')
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
  4,
  'round_of_16',
  NULL,
  false
FROM fixtures f
JOIN teams ht ON ht.name = f.home_team
JOIN teams at ON at.name = f.away_team
ORDER BY f.kickoff_utc;

COMMIT;
